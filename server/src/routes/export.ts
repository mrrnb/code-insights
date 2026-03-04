import { Hono } from 'hono';
import { getDb } from '@code-insights/cli/db/client';
import { trackEvent } from '@code-insights/cli/utils/telemetry';
import { formatKnowledgeBase } from '../export/knowledge-base.js';
import { formatAgentRules } from '../export/agent-rules.js';
import type { SessionRow, InsightRow } from '../export/knowledge-base.js';

const app = new Hono();

type ExportTemplate = 'knowledge-base' | 'agent-rules';

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
    sessions = db.prepare(
      `SELECT id, project_name, generated_title, custom_title, started_at, ended_at,
              message_count, estimated_cost_usd, session_character, source_tool
       FROM sessions WHERE project_id = ? ORDER BY started_at DESC`,
    ).all(projectId) as SessionRow[];
  } else {
    return c.json({ error: 'sessionIds or projectId required' }, 400);
  }

  // Fetch insights for the selected sessions
  let insights: InsightRow[] = [];
  if (sessions.length > 0) {
    const ids = sessions.map((s) => s.id);
    const placeholders = ids.map(() => '?').join(', ');
    insights = db.prepare(
      `SELECT id, session_id, project_id, project_name, type, title, content,
              summary, bullets, confidence, source, metadata, timestamp,
              created_at, scope, analysis_version, linked_insight_ids
       FROM insights WHERE session_id IN (${placeholders})
       ORDER BY type, timestamp`,
    ).all(...ids) as InsightRow[];
  }

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
