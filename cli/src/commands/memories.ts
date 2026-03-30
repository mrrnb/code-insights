import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';
import { getDb } from '../db/client.js';

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

interface MemoriesOptions {
  date?: string;
  project?: string;
  dryRun?: boolean;
  gainsDir?: string;
}

interface SessionRow {
  id: string;
  projectName: string;
  projectPath: string;
  startedAt: string;
  generatedTitle: string | null;
  customTitle: string | null;
  summary: string | null;
  sessionCharacter: string | null;
  sourceTool: string;
  messageCount: number;
  toolCallCount: number;
}

interface MessageRow {
  id: string;
  type: string;
  content: string;
  toolCalls: string | null;
  timestamp: string;
}

// ──────────────────────────────────────────────────────
// DB queries
// ──────────────────────────────────────────────────────

function getSessionsForDate(dateStr: string, projectFilter?: string): SessionRow[] {
  const db = getDb();

  // Build date range for the full day (UTC)
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;

  const conditions = [
    'started_at >= ?',
    'started_at <= ?',
    'deleted_at IS NULL',
  ];
  const params: string[] = [dayStart, dayEnd];

  if (projectFilter) {
    conditions.push('(project_name LIKE ? OR project_path LIKE ?)');
    params.push(`%${projectFilter}%`, `%${projectFilter}%`);
  }

  const sql = `
    SELECT
      id, project_name, project_path, started_at,
      generated_title, custom_title, summary,
      session_character, source_tool,
      message_count, tool_call_count
    FROM sessions
    WHERE ${conditions.join(' AND ')}
    ORDER BY started_at ASC
  `;

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string;
    project_name: string;
    project_path: string;
    started_at: string;
    generated_title: string | null;
    custom_title: string | null;
    summary: string | null;
    session_character: string | null;
    source_tool: string;
    message_count: number;
    tool_call_count: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    projectName: r.project_name,
    projectPath: r.project_path,
    startedAt: r.started_at,
    generatedTitle: r.generated_title,
    customTitle: r.custom_title,
    summary: r.summary,
    sessionCharacter: r.session_character,
    sourceTool: r.source_tool,
    messageCount: r.message_count,
    toolCallCount: r.tool_call_count,
  }));
}

function getMessagesForSession(sessionId: string): MessageRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, type, content, tool_calls, timestamp
    FROM messages
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `).all(sessionId) as Array<{
    id: string;
    type: string;
    content: string;
    tool_calls: string | null;
    timestamp: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    content: r.content,
    toolCalls: r.tool_calls,
    timestamp: r.timestamp,
  }));
}

// ──────────────────────────────────────────────────────
// Classification
// ──────────────────────────────────────────────────────

type MemoryType = 'lesson' | 'observe' | 'truth' | 'session';

function classifySession(session: SessionRow, messages: MessageRow[]): MemoryType {
  const char = session.sessionCharacter ?? '';
  const allText = messages.map((m) => m.content).join(' ').toLowerCase();

  // [lesson]: bug fixes, errors, debugging
  if (
    char === 'bug_hunt' ||
    /error|exception|fix(ed|ing)?|bug|crash|fail(ed|ing)?|debug|stack.?trace|报错|修复/.test(allText)
  ) {
    return 'lesson';
  }

  // [truth]: architecture, conventions, schema changes
  if (
    char === 'feature_build' ||
    char === 'refactor' ||
    /architect|convention|schema|migrat|refactor|约定|架构|设计/.test(allText)
  ) {
    return 'truth';
  }

  // [observe]: user preferences, decisions, philosophy
  if (
    /prefer|don.?t want|i want|理念|偏好|不要|决定|选择|风格/.test(allText)
  ) {
    return 'observe';
  }

  return 'session';
}

// ──────────────────────────────────────────────────────
// Formatting
// ──────────────────────────────────────────────────────

function extractUserExcerpts(messages: MessageRow[]): string {
  return messages
    .filter((m) => m.type === 'user')
    .slice(0, 3)
    .map((m) => m.content.replace(/\n+/g, ' ').trim().slice(0, 200))
    .filter(Boolean)
    .join(' | ');
}

function extractToolSummary(messages: MessageRow[]): string {
  const counts: Record<string, number> = {};

  for (const msg of messages) {
    if (!msg.toolCalls) continue;
    try {
      const calls = JSON.parse(msg.toolCalls) as Array<{ name?: string }>;
      for (const call of calls) {
        if (call.name) counts[call.name] = (counts[call.name] ?? 0) + 1;
      }
    } catch {
      // ignore malformed JSON
    }
  }

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return entries.map(([name, n]) => `${name}×${n}`).join(', ');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildEntry(session: SessionRow, messages: MessageRow[]): string {
  const time = formatTime(session.startedAt);
  const type = classifySession(session, messages);
  const title = session.customTitle ?? session.generatedTitle ?? `${session.projectName} session`;

  const lines: string[] = [];
  lines.push(`## ${time} [${type}] ${title}`);
  lines.push('');

  const userExcerpt = extractUserExcerpts(messages);
  if (userExcerpt) {
    lines.push(userExcerpt);
    lines.push('');
  }

  if (session.summary) {
    lines.push(session.summary.slice(0, 500));
    lines.push('');
  }

  const toolSummary = extractToolSummary(messages);
  if (toolSummary) {
    lines.push(`工具调用: ${toolSummary}`);
    lines.push('');
  }

  lines.push(`> source: code-insights / ${session.sourceTool}`);
  lines.push(`> session: ${session.id}`);

  return lines.join('\n');
}

// ──────────────────────────────────────────────────────
// Dedup helpers
// ──────────────────────────────────────────────────────

function loadExistingSessionIds(filePath: string): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(filePath)) return ids;

  const content = readFileSync(filePath, 'utf-8');
  for (const match of content.matchAll(/^> session: (.+)$/mg)) {
    ids.add(match[1].trim());
  }
  return ids;
}

// ──────────────────────────────────────────────────────
// Main action
// ──────────────────────────────────────────────────────

async function memoriesAction(options: MemoriesOptions): Promise<void> {
  const gainsDir = options.gainsDir ?? '/data/apps/gains';
  const dateStr = options.date ?? new Date().toISOString().slice(0, 10);

  console.log(chalk.cyan('\n  Code Insights — Memories\n'));
  console.log(chalk.dim(`  Date:      ${dateStr}`));
  console.log(chalk.dim(`  Gains dir: ${gainsDir}`));
  if (options.project) console.log(chalk.dim(`  Project:   ${options.project}`));
  if (options.dryRun) console.log(chalk.yellow('  [dry-run] No files will be written.\n'));
  else console.log();

  const sessions = getSessionsForDate(dateStr, options.project);

  if (sessions.length === 0) {
    console.log(chalk.yellow('  No sessions found for this date.'));
    return;
  }

  // Group by project path (fallback to project name)
  const byProject = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const key = s.projectPath || s.projectName;
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(s);
  }

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const [projectPath, projectSessions] of byProject) {
    const projectName = basename(projectPath) || projectPath;
    const memoriesDir = join(gainsDir, projectName, 'aiws', 'memories');
    const filePath = join(memoriesDir, `${dateStr}.md`);

    const existingIds = loadExistingSessionIds(filePath);

    const newEntries: string[] = [];
    for (const session of projectSessions) {
      if (existingIds.has(session.id)) {
        totalSkipped++;
        continue;
      }
      const messages = getMessagesForSession(session.id);
      newEntries.push(buildEntry(session, messages));
    }

    if (newEntries.length === 0) {
      console.log(chalk.dim(`  ${projectName}: all ${projectSessions.length} session(s) already recorded`));
      continue;
    }

    const newContent = newEntries.join('\n\n---\n\n');

    if (options.dryRun) {
      console.log(chalk.cyan(`  ▶ ${projectName} → ${filePath}`));
      console.log(chalk.dim('  ' + '─'.repeat(64)));
      for (const line of newContent.split('\n')) {
        console.log('  ' + line);
      }
      console.log(chalk.dim('  ' + '─'.repeat(64)));
      console.log();
    } else {
      if (!existsSync(memoriesDir)) {
        mkdirSync(memoriesDir, { recursive: true });
      }

      if (existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8').trimEnd();
        writeFileSync(filePath, `${existing}\n\n---\n\n${newContent}`, 'utf-8');
      } else {
        writeFileSync(filePath, newContent, 'utf-8');
      }

      console.log(chalk.green(`  ✓ ${projectName}: ${newEntries.length} entr${newEntries.length === 1 ? 'y' : 'ies'} → ${filePath}`));
    }

    totalWritten += newEntries.length;
  }

  if (totalSkipped > 0) {
    console.log(chalk.dim(`\n  Skipped ${totalSkipped} already-recorded session(s).`));
  }

  console.log();
  if (options.dryRun) {
    console.log(chalk.cyan(`  [dry-run] ${totalWritten} entr${totalWritten === 1 ? 'y' : 'ies'} across ${byProject.size} project(s).`));
  } else {
    console.log(chalk.green(`  Done. ${totalWritten} entr${totalWritten === 1 ? 'y' : 'ies'} written across ${byProject.size} project(s).`));
  }
}

// ──────────────────────────────────────────────────────
// Command export
// ──────────────────────────────────────────────────────

export const memoriesCommand = new Command('memories')
  .description('Extract session memories and write to .aiws/memories/ per project')
  .option('--date <date>', 'Date to process (YYYY-MM-DD, default: today)')
  .option('--project <name>', 'Filter by project name or path fragment')
  .option('--dry-run', 'Preview output without writing files')
  .option('--gains-dir <dir>', 'Root gains directory (default: /data/apps/gains)')
  .action(async (options: MemoriesOptions) => {
    await memoriesAction(options);
  });
