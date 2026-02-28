import { SessionCard } from './SessionCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Session } from '@/lib/types';

interface SessionListProps {
  sessions: Session[];
  loading?: boolean;
  error?: string | null;
  onRenamed?: () => void;
}

export function SessionList({ sessions, loading, error, onRenamed }: SessionListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Error loading sessions: {error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No sessions found.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1">code-insights sync</code> to sync your sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} onRenamed={onRenamed} />
      ))}
    </div>
  );
}
