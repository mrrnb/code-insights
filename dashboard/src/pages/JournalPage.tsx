import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { useInsights } from '@/hooks/useInsights';
import { useLlmConfig } from '@/hooks/useConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Target, Lightbulb, GitBranch, Clock } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorCard } from '@/components/ErrorCard';
import type { Insight } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return format(start, 'yyyy-MM-dd');
}

function getWeekLabel(weekKey: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const start = new Date(weekKey + 'T00:00:00');
  const end = endOfWeek(start, { weekStartsOn: 1 });
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  if (weekKey === format(thisWeekStart, 'yyyy-MM-dd')) {
    return `${t('journal.thisWeek')} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`;
  }
  if (weekKey === format(lastWeekStart, 'yyyy-MM-dd')) {
    return `${t('journal.lastWeek')} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`;
  }
  return t('journal.weekOf', { date: format(start, 'MMMM d, yyyy') });
}

export default function JournalPage() {
  const { t } = useI18n();
  const { data: insights = [], isLoading, isError, refetch } = useInsights();
  const { data: llmConfig } = useLlmConfig();

  const llmConfigured = !!(llmConfig?.provider && llmConfig?.model);

  // Group learnings and decisions by week for the timeline
  const insightsByWeek = useMemo(() => {
    const relevant = insights.filter(
      (i) => i.type === 'learning' || i.type === 'decision' || i.type === 'technique'
    );
    const grouped: Record<string, Insight[]> = {};
    relevant.forEach((insight) => {
      const weekKey = getWeekKey(insight.timestamp);
      if (!grouped[weekKey]) grouped[weekKey] = [];
      grouped[weekKey].push(insight);
    });
    return grouped;
  }, [insights]);

  const sortedWeeks = useMemo(
    () => Object.keys(insightsByWeek).sort((a, b) => b.localeCompare(a)),
    [insightsByWeek]
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('journal.title')}</h1>
        <p className="text-muted-foreground">
          {t('journal.desc')}
        </p>
      </div>

      {isError && (
        <ErrorCard message={t('journal.error')} onRetry={refetch} />
      )}

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            {t('journal.timeline')}
          </TabsTrigger>
          <TabsTrigger value="patterns" className="gap-2">
            <GitBranch className="h-4 w-4" />
            {t('journal.patterns')}
          </TabsTrigger>
        </TabsList>

        {/* {t('journal.timeline')} tab */}
        <TabsContent value="timeline" className="space-y-2 mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t('journal.loading')}</div>
          ) : sortedWeeks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('journal.empty')}
            </div>
          ) : (
            <div className="space-y-8">
              {sortedWeeks.map((weekKey) => {
                const weekInsights = insightsByWeek[weekKey];
                const weekLearnings = weekInsights.filter(
                  (i) => i.type === 'learning' || i.type === 'technique'
                );
                const weekDecisions = weekInsights.filter((i) => i.type === 'decision');

                return (
                  <div key={weekKey} className="space-y-3">
                    {/* Week header */}
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-semibold text-foreground">
                        {getWeekLabel(weekKey, t)}
                      </h2>
                      <div className="flex gap-2">
                        {weekLearnings.length > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Lightbulb className="h-3 w-3" />
                            {t('journal.learningCount', { count: weekLearnings.length })}
                          </Badge>
                        )}
                        {weekDecisions.length > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Target className="h-3 w-3" />
                            {t('journal.decisionCount', { count: weekDecisions.length })}
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Insights in this week, sorted newest first */}
                    <div className="space-y-2 pl-2 border-l-2 border-border ml-2">
                      {[...weekInsights]
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        )
                        .map((insight) => {
                          const isLearning =
                            insight.type === 'learning' || insight.type === 'technique';
                          return (
                            <div key={insight.id} className="relative pl-4 py-2 group">
                              {/* {t('journal.timeline')} dot */}
                              <div
                                className={`absolute left-[-9px] top-[14px] h-3 w-3 rounded-full border-2 border-background ${
                                  isLearning ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}
                              />
                              <div className="flex items-start gap-2">
                                {isLearning ? (
                                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                                ) : (
                                  <Target className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-snug">
                                    {insight.title}
                                  </p>
                                  {insight.content && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {insight.content}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {insight.project_name} &middot;{' '}
                                    {format(new Date(insight.timestamp), 'MMM d')}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-xs shrink-0 ${
                                    isLearning
                                      ? 'text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700'
                                      : 'text-blue-700 border-blue-300 dark:text-blue-400 dark:border-blue-700'
                                  }`}
                                >
                                  {insight.type === 'technique' ? 'technique' : insight.type}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* {t('journal.patterns')} tab */}
        <TabsContent value="patterns" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    {t('journal.patternAnalysis')}
                  </CardTitle>
                  <CardDescription>
                    {t('journal.patternAnalysisDesc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!llmConfigured ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('journal.configureAi')}</p>
                  <Link
                    to="/settings"
                    className="text-primary text-sm underline hover:text-primary/80 mt-2 inline-block"
                  >
                    Go to Settings
                  </Link>
                </div>
              ) : insights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('journal.noInsightsYet')}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground space-y-3">
                  <p>
                    {t('journal.summary', { insights: insights.length, weeks: sortedWeeks.length })}
                  </p>
                  <p className="text-sm">
                    Pattern analysis uses the session analysis feature. Go to a session and click
                    "Analyze" to generate insights, then check back here for timeline trends.
                  </p>
                  <Link
                    to="/sessions"
                    className="text-primary text-sm underline hover:text-primary/80 inline-block"
                  >
                    {t('journal.viewSessions')}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
