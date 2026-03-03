import { useMemo } from 'react';
import { Link } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Repeat2 } from 'lucide-react';
import { INSIGHT_TYPE_LABELS } from '@/lib/constants/colors';
import type { Insight, InsightType } from '@/lib/types';
import { parseJsonField } from '@/lib/types';

interface RecurringPatternsSectionProps {
  insights: Insight[];
}

interface PatternGroup {
  key: string;
  title: string;
  type: string;
  count: number;
  projects: string[];
  lastSeen: string;
  insightIds: Set<string>;
}

export function RecurringPatternsSection({ insights }: RecurringPatternsSectionProps) {
  const patterns = useMemo((): PatternGroup[] => {
    // Build a reverse map: linkedId -> set of insights that reference it
    const linkedToInsights = new Map<string, Set<string>>();
    const insightMap = new Map<string, Insight>();

    for (const insight of insights) {
      insightMap.set(insight.id, insight);
      const linkedIds = insight.linked_insight_ids
        ? parseJsonField<string[]>(insight.linked_insight_ids, [])
        : [];
      for (const linkedId of linkedIds) {
        const set = linkedToInsights.get(linkedId) || new Set();
        set.add(insight.id);
        linkedToInsights.set(linkedId, set);
      }
    }

    // Group insights that share any linked ID using union-find approach
    const parent = new Map<string, string>();
    function find(id: string): string {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
      return parent.get(id)!;
    }
    function union(a: string, b: string) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }

    for (const [, insightIds] of linkedToInsights) {
      const arr = [...insightIds];
      for (let i = 1; i < arr.length; i++) {
        union(arr[0], arr[i]);
      }
    }

    // Collect groups
    const groups = new Map<string, Set<string>>();
    for (const [, insightIds] of linkedToInsights) {
      for (const id of insightIds) {
        const root = find(id);
        const set = groups.get(root) || new Set();
        set.add(id);
        groups.set(root, set);
      }
    }

    // Filter to groups with 2+ insights and build PatternGroup objects
    const result: PatternGroup[] = [];
    for (const [key, ids] of groups) {
      if (ids.size < 2) continue;

      const groupInsights = [...ids]
        .map((id) => insightMap.get(id))
        .filter((i): i is Insight => !!i);

      if (groupInsights.length < 2) continue;

      // Most common type in group
      const typeCounts = new Map<string, number>();
      for (const i of groupInsights) {
        typeCounts.set(i.type, (typeCounts.get(i.type) || 0) + 1);
      }
      const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      const projects = [...new Set(groupInsights.map((i) => i.project_name))];
      const lastSeen = groupInsights
        .map((i) => i.created_at)
        .sort()
        .pop()!;

      result.push({
        key,
        title: groupInsights[0].title,
        type: dominantType,
        count: groupInsights.length,
        projects,
        lastSeen,
        insightIds: ids,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }, [insights]);

  if (patterns.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Repeat2 className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-medium">Recurring Patterns</h2>
        <Badge variant="secondary" className="text-xs">
          {patterns.length}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {patterns.map((pattern) => (
          <Link
            key={pattern.key}
            to={`/insights?pattern=${pattern.key}`}
            className="block rounded-lg border p-3 hover:bg-accent/40 transition-colors space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium line-clamp-2">{pattern.title}</p>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 shrink-0">
                {pattern.count}x
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{INSIGHT_TYPE_LABELS[pattern.type as InsightType] || pattern.type}</span>
              <span>--</span>
              <span className="truncate">{pattern.projects.join(', ')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last seen {formatDistanceToNow(new Date(pattern.lastSeen), { addSuffix: true })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
