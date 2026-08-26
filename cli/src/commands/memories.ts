import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
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
  const title = session.customTitle ?? session.generatedTitle ?? `${session.projectName} 会话`;

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

  console.log(chalk.cyan('\n  Code Insights — 记忆\n'));
  console.log(chalk.dim(`  日期：    ${dateStr}`));
  console.log(chalk.dim(`  Gains 目录：${gainsDir}`));
  if (options.project) console.log(chalk.dim(`  项目：    ${options.project}`));
  if (options.dryRun) console.log(chalk.yellow('  [试运行] 不会写入任何文件。\n'));
  else console.log();

  const sessions = getSessionsForDate(dateStr, options.project);

  if (sessions.length === 0) {
    console.log(chalk.yellow('  该日期没有发现会话。'));
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
    if (!existsSync(memoriesDir)) {
      console.log(chalk.dim(`  跳过 ${projectName}：${memoriesDir} 目录不存在`));
      continue;
    }
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
      console.log(chalk.dim(`  ${projectName}：所有 ${projectSessions.length} 个会话已记录`));
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
      if (existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8').trimEnd();
        writeFileSync(filePath, `${existing}\n\n---\n\n${newContent}`, 'utf-8');
      } else {
        writeFileSync(filePath, newContent, 'utf-8');
      }

      console.log(chalk.green(`  ✓ ${projectName}: ${newEntries.length} 条记录 → ${filePath}`));
    }

    totalWritten += newEntries.length;
  }

  if (totalSkipped > 0) {
    console.log(chalk.dim(`\n  跳过 ${totalSkipped} 个已记录的会话。`));
  }

  console.log();
  if (options.dryRun) {
    console.log(chalk.cyan(`  [试运行] ${byProject.size} 个项目中共 ${totalWritten} 条记录。`));
  } else {
    console.log(chalk.green(`  完成。${byProject.size} 个项目中共写入 ${totalWritten} 条记录。`));
  }
}

// ──────────────────────────────────────────────────────
// Command export
// ──────────────────────────────────────────────────────

export const memoriesCommand = new Command('memories')
  .description('提取会话记忆并写入已存在的 .aiws/memories/；目录不存在则跳过，不创建')
  .option('--date <date>', '要处理的日期（YYYY-MM-DD，默认：今天）')
  .option('--project <name>', '按项目名称或路径片段筛选')
  .option('--dry-run', '预览输出但不写入文件')
  .option('--gains-dir <dir>', 'Gains 根目录（默认：/data/apps/gains）')
  .action(async (options: MemoriesOptions) => {
    await memoriesAction(options);
  });
