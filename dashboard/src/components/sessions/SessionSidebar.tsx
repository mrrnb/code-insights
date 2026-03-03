import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OutcomeBadge } from '@/components/insights/InsightCard';
import { SESSION_CHARACTER_LABELS, SOURCE_TOOL_COLORS } from '@/lib/constants/colors';
import { INSIGHT_TYPE_LABELS } from '@/lib/constants/colors';
import { formatDuration, formatModelName } from '@/lib/utils';
import { parseJsonField } from '@/lib/types';
import type { Session, Insight, InsightMetadata, InsightType } from '@/lib/types';

interface SessionSidebarProps {
  session: Session;
  insights: Insight[];
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function SessionSidebar({ session, insights }: SessionSidebarProps) {
  const startedAt = new Date(session.started_at);
  const endedAt = new Date(session.ended_at);
  const modelsUsed = parseJsonField<string[]>(session.models_used, []);

  const summaryInsight = insights.find((i) => i.type === 'summary');
  const outcome = summaryInsight
    ? parseJsonField<InsightMetadata>(summaryInsight.metadata, {}).outcome
    : undefined;

  const insightCounts = new Map<string, number>();
  for (const insight of insights) {
    if (insight.type === 'summary') continue;
    insightCounts.set(insight.type, (insightCounts.get(insight.type) || 0) + 1);
  }

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r sticky top-0 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <dl className="p-4 space-y-4">
        <SidebarField label="Duration">
          {formatDuration(startedAt, endedAt)}
        </SidebarField>

        <SidebarField label="Messages">
          {session.user_message_count} user / {session.assistant_message_count} assistant
        </SidebarField>

        <SidebarField label="Tool Calls">
          {session.tool_call_count}
        </SidebarField>

        {session.estimated_cost_usd != null && (
          <SidebarField label="Cost">
            ${session.estimated_cost_usd.toFixed(4)}
          </SidebarField>
        )}

        {session.total_input_tokens != null && (
          <SidebarField label="Tokens">
            {session.total_input_tokens.toLocaleString()} in / {session.total_output_tokens?.toLocaleString()} out
          </SidebarField>
        )}

        <Separator />

        {modelsUsed.length > 0 && (
          <SidebarField label="Models">
            <div className="flex flex-wrap gap-1 mt-0.5">
              {modelsUsed.map((m) => (
                <span key={m} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {formatModelName(m)}
                </span>
              ))}
            </div>
          </SidebarField>
        )}

        {session.git_branch && (
          <SidebarField label="Branch">
            <span className="font-mono text-xs break-all">{session.git_branch}</span>
          </SidebarField>
        )}

        {session.source_tool && (
          <SidebarField label="Source">
            <Badge
              variant="outline"
              className={`text-xs capitalize ${SOURCE_TOOL_COLORS[session.source_tool] ?? 'bg-muted text-muted-foreground'}`}
            >
              {session.source_tool}
            </Badge>
          </SidebarField>
        )}

        {session.session_character && (
          <SidebarField label="Character">
            {SESSION_CHARACTER_LABELS[session.session_character] || session.session_character}
          </SidebarField>
        )}

        {outcome && (
          <SidebarField label="Outcome">
            <OutcomeBadge outcome={outcome} />
          </SidebarField>
        )}

        <Separator />

        {insightCounts.size > 0 && (
          <SidebarField label="Insights">
            <div className="flex flex-wrap gap-1 mt-0.5">
              {[...insightCounts.entries()].map(([type, count]) => (
                <span key={type} className="text-xs text-muted-foreground">
                  {count} {INSIGHT_TYPE_LABELS[type as InsightType] || type}
                  {count !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
          </SidebarField>
        )}

        <SidebarField label="Project">
          <Link
            to={`/sessions?project=${session.project_id}`}
            className="text-sm hover:underline underline-offset-2"
          >
            {session.project_name}
          </Link>
        </SidebarField>
      </dl>
    </aside>
  );
}
