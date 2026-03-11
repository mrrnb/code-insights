import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { analyzeSession } from '@/lib/api';
import { useLlmConfig } from '@/hooks/useConfig';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@/lib/types';

interface BulkAnalyzeButtonProps {
  sessions: Session[];
  onComplete?: () => void;
}

export function BulkAnalyzeButton({ sessions, onComplete }: BulkAnalyzeButtonProps) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState<{
    successful: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const { data: llmConfig } = useLlmConfig();
  const queryClient = useQueryClient();

  const configured = !!(llmConfig?.provider && llmConfig?.model);

  const handleAnalyze = async () => {
    if (!configured || sessions.length === 0) return;

    setAnalyzing(true);
    setProgress({ completed: 0, total: sessions.length });
    setResult(null);

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const session of sessions) {
      try {
        await analyzeSession(session.id);
        successful++;
      } catch (error) {
        failed++;
        errors.push(error instanceof Error ? error.message : `Failed: ${session.id}`);
      }
      setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
    }

    // Invalidate all insight queries
    queryClient.invalidateQueries({ queryKey: ['insights'] });
    queryClient.invalidateQueries({ queryKey: ['sessions'] });

    setResult({ successful, failed, errors });
    setAnalyzing(false);
    onComplete?.();
  };

  const handleClose = () => {
    if (!analyzing) {
      setOpen(false);
      setResult(null);
      setProgress({ completed: 0, total: 0 });
    }
  };

  if (!configured) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Sparkles className="h-4 w-4" />
        批量分析
        <span className="text-xs text-muted-foreground ml-1">（请先配置 AI）</span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
          disabled={sessions.length === 0}
          onClick={() => setOpen(true)}
        >
          <Sparkles className="h-4 w-4" />
          分析 {sessions.length} 个会话
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量分析</DialogTitle>
          <DialogDescription>
            为已选中的 {sessions.length} 个会话生成 AI 洞察。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!analyzing && !result && (
            <>
              <p className="text-sm text-muted-foreground">
                将使用当前配置的 LLM 提供商逐个分析会话并生成洞察。
              </p>
              <Button onClick={handleAnalyze} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                开始分析
              </Button>
            </>
          )}

          {analyzing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  正在分析第 {progress.completed} / {progress.total} 个会话...
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>
                  成功分析 {result.successful} 个会话
                </span>
              </div>
              {result.failed > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                      <span>失败 {result.failed} 个</span>
                  </div>
                  <ul className="text-xs text-muted-foreground list-disc list-inside max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="truncate">{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>... 另外还有 {result.errors.length - 5} 条</li>
                    )}
                  </ul>
                </div>
              )}
              <Button onClick={handleClose} className="w-full">
                完成
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
