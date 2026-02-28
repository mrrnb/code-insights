import { useState } from 'react';
import { Link } from 'react-router';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare, Wrench, GitBranch, Clock, Pencil } from 'lucide-react';
import { getSessionTitle, formatModelName } from '@/lib/utils';
import type { Session } from '@/lib/types';
import { RenameSessionDialog } from './RenameSessionDialog';

interface SessionCardProps {
  session: Session;
  onRenamed?: () => void;
}

export function SessionCard({ session, onRenamed }: SessionCardProps) {
  const [renameOpen, setRenameOpen] = useState(false);

  const startedAt = new Date(session.started_at);
  const endedAt = new Date(session.ended_at);
  const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  const displayTitle = getSessionTitle(session);

  return (
    <>
      <Link to={`/sessions/${session.id}`}>
        <Card className="group cursor-pointer transition-colors hover:bg-accent/50">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base font-medium line-clamp-1">
                    {displayTitle}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRenameOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="sr-only">Rename session</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Rename session</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {session.project_name}
                  </p>
                  {session.session_character && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {session.session_character.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                {session.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {session.summary.split('\n').filter(l => l.startsWith('- ')).slice(0, 2).map(l => l.slice(2)).join(' / ')
                      || session.summary.slice(0, 100)}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="text-xs">
                {formatDistanceToNow(startedAt, { addSuffix: true })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{session.message_count} messages</span>
              </div>
              <div className="flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" />
                <span>{session.tool_call_count} tools</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{duration} min</span>
              </div>
              {session.git_branch && (
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[100px]">{session.git_branch}</span>
                </div>
              )}
              {session.primary_model && (
                <div className="hidden sm:flex items-center gap-1">
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {formatModelName(session.primary_model)}
                  </span>
                </div>
              )}
              {session.estimated_cost_usd != null && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    ${session.estimated_cost_usd.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
      <RenameSessionDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        sessionId={session.id}
        currentTitle={displayTitle}
        onRenamed={onRenamed}
      />
    </>
  );
}
