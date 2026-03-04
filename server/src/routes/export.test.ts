import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runMigrations } from '@code-insights/cli/db/schema';

// ──────────────────────────────────────────────────────
// Module-scoped mutable DB reference for mocking.
// ──────────────────────────────────────────────────────

let testDb: Database.Database;

vi.mock('@code-insights/cli/db/client', () => ({
  getDb: () => testDb,
  closeDb: () => {},
}));

vi.mock('@code-insights/cli/utils/telemetry', () => ({
  trackEvent: vi.fn(),
}));

const { createApp } = await import('../index.js');

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

function initTestDb(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

function seedProjectAndSession(projectId: string, sessionId: string) {
  testDb.prepare(`
    INSERT INTO projects (id, name, path, last_activity, session_count)
    VALUES (?, 'test', '/test', datetime('now'), 1)
  `).run(projectId);

  testDb.prepare(`
    INSERT INTO sessions (id, project_id, project_name, project_path,
      started_at, ended_at, message_count, source_tool,
      generated_title, estimated_cost_usd)
    VALUES (?, ?, 'test', '/test', '2025-06-15T10:00:00Z', '2025-06-15T11:00:00Z',
      5, 'claude-code', 'Test Session', 0.25)
  `).run(sessionId, projectId);
}

function seedInsight(
  sessionId: string,
  projectId: string,
  type: string,
  title: string,
  content: string,
  metadata: Record<string, unknown>,
) {
  testDb.prepare(`
    INSERT INTO insights (id, session_id, project_id, project_name, type, title, content, summary, confidence, source, metadata, timestamp)
    VALUES (?, ?, ?, 'test', ?, ?, ?, ?, 0.9, 'llm', ?, datetime('now'))
  `).run(randomUUID(), sessionId, projectId, type, title, content, content, JSON.stringify(metadata));
}

// ──────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────

describe('Export routes', () => {
  beforeEach(() => {
    testDb = initTestDb();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('POST /api/export/markdown', () => {
    it('exports markdown for given session IDs', async () => {
      seedProjectAndSession('proj-1', 'sess-1');

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: ['sess-1'] }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/markdown');
      const text = await res.text();
      expect(text).toContain('# Code Insights Export');
      expect(text).toContain('Test Session');
    });

    it('returns 200 with markdown when neither sessionIds nor projectId provided ("everything" export)', async () => {
      seedProjectAndSession('proj-1', 'sess-1');

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# Code Insights Export');
      expect(text).toContain('Test Session');
    });

    it('returns 400 when sessionIds is not an array', async () => {
      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: 'not-an-array' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('sessionIds must be an array');
    });

    it('exports by projectId when no sessionIds provided', async () => {
      seedProjectAndSession('proj-1', 'sess-1');

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'proj-1' }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# Code Insights Export');
      expect(text).toContain('Test Session');
    });

    it('returns header-only markdown when no sessions match', async () => {
      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: ['nonexistent'] }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# Code Insights Export');
      // No session sections — just the header
      expect(text).not.toContain('## ');
    });

    it('returns 400 when template is invalid', async () => {
      seedProjectAndSession('proj-1', 'sess-1');

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: ['sess-1'], template: 'invalid' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('template must be');
    });

    it('knowledge-base template includes structured insight content', async () => {
      seedProjectAndSession('proj-1', 'sess-1');
      seedInsight('sess-1', 'proj-1', 'decision', 'Use SQLite over Postgres', 'Chose SQLite for local-first simplicity.', {
        reasoning: 'No network overhead, zero-config, works offline',
        choice: 'SQLite',
        situation: 'local-first data storage',
        alternatives: [{ option: 'Postgres', rejected_because: 'too slow to set up locally' }],
        revisit_when: 'multi-user collaboration is needed',
      });
      seedInsight('sess-1', 'proj-1', 'learning', 'WAL mode prevents read locks', 'WAL mode allows concurrent reads during writes.', {
        symptom: 'CLI sync blocked dashboard reads',
        root_cause: 'default journal mode locks the entire database during writes',
        takeaway: 'Always enable WAL mode for local SQLite databases with concurrent access',
        applies_when: 'running CLI sync while dashboard is open',
      });

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: ['sess-1'], template: 'knowledge-base' }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();

      // Session present
      expect(text).toContain('Test Session');
      // Decision insight
      expect(text).toContain('Use SQLite over Postgres');
      expect(text).toContain('**Reasoning:**');
      // Verifies the rejected_because fix — must appear in output
      expect(text).toContain('rejected because too slow to set up locally');
      // Learning insight
      expect(text).toContain('WAL mode prevents read locks');
      expect(text).toContain('**What Happened:**');
      expect(text).toContain('**Root Cause:**');
      expect(text).toContain('**Takeaway:**');
    });

    it('agent-rules template produces imperative format', async () => {
      seedProjectAndSession('proj-1', 'sess-1');
      seedInsight('sess-1', 'proj-1', 'decision', 'Use SQLite over Postgres', 'Chose SQLite for local-first simplicity.', {
        reasoning: 'No network overhead, zero-config, works offline',
        choice: 'SQLite',
        situation: 'local-first data storage',
        alternatives: [{ option: 'Postgres', rejected_because: 'too slow to set up locally' }],
        revisit_when: 'multi-user collaboration is needed',
      });
      seedInsight('sess-1', 'proj-1', 'learning', 'WAL mode prevents read locks', 'WAL mode allows concurrent reads during writes.', {
        symptom: 'CLI sync blocked dashboard reads',
        root_cause: 'default journal mode locks the entire database during writes',
        takeaway: 'Always enable WAL mode for local SQLite databases with concurrent access',
        applies_when: 'running CLI sync while dashboard is open',
      });

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: ['sess-1'], template: 'agent-rules' }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();

      expect(text).toContain('# Agent Rules Export');
      expect(text).toContain('## Decisions');
      expect(text).toContain('- USE SQLite');
      expect(text).toContain('- DO NOT use Postgres');
      expect(text).toContain('## Learnings');
      expect(text).toContain('- WHEN ');
    });

    it('sessions with no insights show graceful note', async () => {
      seedProjectAndSession('proj-1', 'sess-1');
      // No insights seeded

      const app = createApp();
      const res = await app.request('/api/export/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: ['sess-1'], template: 'knowledge-base' }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('*No insights for this session.*');
    });
  });
});
