import { Hono } from 'hono';
import { getDb } from '@code-insights/cli/db/client';
import { trackEvent } from '@code-insights/cli/utils/telemetry';
import type { ExportTemplate } from '@code-insights/cli/types';
import { formatKnowledgeBase } from '../export/knowledge-base.js';
import { formatAgentRules } from '../export/agent-rules.js';
import type { SessionRow, InsightRow } from '../export/knowledge-base.js';

const app = new Hono();

// SQLite SQLITE_LIMIT_VARIABLE_NUMBER is 999 by default.
// Batch insights queries to avoid hitting this limit for large session sets.
const INSIGHTS_BATCH_SIZE = 500;

function fetchInsightsForSessions(db: ReturnType<typeof getDb>, sessionIds: string[]): InsightRow[] {
  if (sessionIds.length === 0) return [];

  const results: InsightRow[] = [];
  for (let i = 0; i < sessionIds.length; i += INSIGHTS_BATCH_SIZE) {
    const chunk = sessionIds.slice(i, i + INSIGHTS_BATCH_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = db.prepare(
      `SELECT id, session_id, project_id, project_name, type, title, content,
              summary, bullets, confidence, source, metadata, timestamp,
              created_at, scope, analysis_version, linked_insight_ids
       FROM insights WHERE session_id IN (${placeholders})
       ORDER BY type, timestamp`,
    ).all(...chunk) as InsightRow[];
    results.push(...rows);
  }
  return results;
}

// POST /api/export/markdown — export sessions/insights as markdown
app.post('/markdown', async (c) => {
  const db = getDb();
  const body = await c.req.json<{
    sessionIds?: string[];
    projectId?: string;
    template?: ExportTemplate;
  }>();

  const { sessionIds, projectId, template = 'knowledge-base' } = body;

  if (template !== 'knowledge-base' && template !== 'agent-rules') {
    return c.json({ error: 'template must be "knowledge-base" or "agent-rules"' }, 400);
  }
  if (sessionIds !== undefined && !Array.isArray(sessionIds)) {
    return c.json({ error: 'sessionIds must be an array' }, 400);
  }
  if (sessionIds && (sessionIds as unknown[]).some((id) => typeof id !== 'string')) {
    return c.json({ error: 'sessionIds must contain only strings' }, 400);
  }
  if (sessionIds && sessionIds.length > 100) {
    return c.json({ error: 'Maximum 100 session IDs per export request' }, 400);
  }

  let sessions: SessionRow[];
  if (sessionIds && sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => '?').join(', ');
    sessions = db.prepare(
      `SELECT id, project_name, generated_title, custom_title, started_at, ended_at,
              message_count, estimated_cost_usd, session_character, source_tool
       FROM sessions WHERE id IN (${placeholders}) ORDER BY started_at DESC`,
    ).all(...sessionIds) as SessionRow[];
  } else if (projectId) {
    // Cap at 100 to avoid unbounded queries and SQLite variable limit on insight fetch
    sessions = db.prepare(
      `SELECT id, project_name, generated_title, custom_title, started_at, ended_at,
              message_count, estimated_cost_usd, session_character, source_tool
       FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT 100`,
    ).all(projectId) as SessionRow[];
  } else {
    // "Everything" export — most recent 100 sessions
    sessions = db.prepare(
      `SELECT id, project_name, generated_title, custom_title, started_at, ended_at,
              message_count, estimated_cost_usd, session_character, source_tool
       FROM sessions ORDER BY started_at DESC LIMIT 100`,
    ).all() as SessionRow[];
  }

  const insights = fetchInsightsForSessions(db, sessions.map((s) => s.id));

  const markdown =
    template === 'agent-rules'
      ? formatAgentRules(sessions, insights)
      : formatKnowledgeBase(sessions, insights);

  trackEvent('export_run', {
    format: 'markdown',
    template,
    session_count: sessions.length,
    insight_count: insights.length,
    success: true,
  });

  c.header('Content-Type', 'text/markdown');
  return c.body(markdown);
});

export default app;
