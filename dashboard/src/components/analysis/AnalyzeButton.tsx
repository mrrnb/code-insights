import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router';
import { useAnalysis } from './AnalysisContext';
import { useLlmConfig } from '@/hooks/useConfig';
import type { Session } from '@/lib/types';

interface AnalyzeButtonProps {
  session: Session;
  hasExistingInsights?: boolean;
  insightCount?: number;
}

export function AnalyzeButton({ session, hasExistingInsights, insightCount }: AnalyzeButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { state: analysisState, startAnalysis, cancelAnalysis } = useAnalysis();
  const { data: llmConfig } = useLlmConfig();

  const configured = !!(llmConfig?.provider && llmConfig?.model);

  const isAnalyzingThisSession =
    analysisState.status === 'analyzing' && analysisState.sessionId === session.id && analysisState.type === 'session';
  const isAnalyzingOther =
    analysisState.status === 'analyzing' && !isAnalyzingThisSession;
  const isCompleteForThisSession =
    (analysisState.status === 'complete' || analysisState.status === 'error') &&
    analysisState.sessionId === session.id &&
    analysisState.type === 'session';

  const handleAnalyze = () => {
    startAnalysis(session, 'session');
  };

  const handleClick = () => {
    if (hasExistingInsights && !isCompleteForThisSession) {
      setConfirmOpen(true);
    } else {
      handleAnalyze();
    }
  };

  const isReanalyze = hasExistingInsights || isCompleteForThisSession;

  if (!configured) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>
          请先在{' '}
          <Link to="/settings" className="underline hover:text-foreground">
            设置
          </Link>{' '}
          中配置 AI 提供商后再分析会话
        </span>
      </div>
    );
  }

  if (isAnalyzingThisSession) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button disabled variant="outline" className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {analysisState.progress?.message || `Analyzing "${analysisState.sessionTitle}"...`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={cancelAnalysis}
          >
            <X className="h-3.5 w-3.5" />
            取消
          </Button>
        </div>
      </div>
    );
  }

  if (isAnalyzingOther) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button disabled variant="outline" className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在分析中...
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          正在等待 “{analysisState.sessionTitle}” 分析完成
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleClick}
          variant={isReanalyze ? 'outline' : 'default'}
          className="gap-2"
        >
          {isReanalyze ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              重新分析会话
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              分析会话
            </>
          )}
        </Button>

        {!isReanalyze && (
          <span className="text-xs text-muted-foreground">
            {session.message_count} messages
          </span>
        )}
      </div>

      {isReanalyze && !isCompleteForThisSession && (
        <p className="text-xs text-muted-foreground">
          会覆盖现有洞察，并消耗 LLM Tokens。
        </p>
      )}

      {isCompleteForThisSession && analysisState.result?.success && (
        <div className="text-sm text-green-600">
          {analysisState.result.insightCount != null
            ? `分析完成，已保存 ${analysisState.result.insightCount} 条洞察。`
            : '分析完成，洞察已保存。'}
        </div>
      )}

      {isCompleteForThisSession && !analysisState.result?.success && (
        <div className="flex items-start gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{analysisState.result?.error || '分析失败'}</span>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>要重新分析这个会话吗？</AlertDialogTitle>
            <AlertDialogDescription>
              这会用新的分析结果替换现有的 {insightCount ?? 0} 条洞察。
              该操作会消耗 LLM Tokens，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnalyze}>重新分析</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
