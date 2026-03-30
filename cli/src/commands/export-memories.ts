import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { getDb } from '../db/client.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_FILE = join(homedir(), '.code-insights', 'export-state.json');
const DEFAULT_GAINS_DIR = '/data/apps/gains';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportMemoriesOptions {
  force?: boolean;
  project?: string;
  date?: string;
  quiet?: boolean;
  verbose?: boolean;
  gainsDir?: string;
}

interface SessionRow {
  id: string;
  project_name: string;
  source_tool: string;
  started_at: string;
  ended_at: string;
  summary: string | null;
  generated_title: string | null;
  custom_title: string | null;
  primary_model: string | null;
  estimated_cost_usd: number | null;
  message_count: number;
  tool_call_count: number;
}

interface FacetRow {
  outcome_satisfaction: string;
  workflow_pattern: string | null;
  friction_points: string | null;
  effective_patterns: string | null;
}

interface InsightRow {
  type: string;
  title: string;
  summary: string;
  bullets: string | null;
}

interface FrictionPoint {
  category: string;
  description: string;
  attribution?: string;
  severity?: string;
}

interface EffectivePattern {
  category: string;
  description: string;
  driver?: string;
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function loadExportedIds(): Set<string> {
  if (!existsSync(STATE_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as { exported?: string[] };
    return new Set(data.exported ?? []);
  } catch {
    return new Set();
  }
}

function saveExportedIds(ids: Set<string>): void {
  writeFileSync(STATE_FILE, JSON.stringify({ exported: Array.from(ids) }, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function sourceAbbrev(sourceTool: string): string {
  switch (sourceTool) {
    case 'claude-code': return 'claude';
    case 'codex-cli': return 'codex';
    case 'copilot-cli': return 'copilot';
    default: return sourceTool; // cursor, copilot, etc.
  }
}

function durationMinutes(startedAt: string, endedAt: string): number {
  return Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
}

function buildFileContent(
  session: SessionRow,
  facets: FacetRow | undefined,
  insights: InsightRow[]
): string {
  const date = session.started_at.slice(0, 10);
  const title = session.custom_title ?? session.generated_title ?? `${session.project_name} session`;
  const duration = durationMinutes(session.started_at, session.ended_at);
  const cost = session.estimated_cost_usd != null
    ? `$${session.estimated_cost_usd.toFixed(4)}`
    : '$0.0000';

  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`session_id: ${session.id}`);
  lines.push(`project: ${session.project_name}`);
  lines.push(`source: ${session.source_tool}`);
  lines.push(`date: ${date}`);
  lines.push(`duration: ${duration}`);
  lines.push(`model: ${session.primary_model ?? 'unknown'}`);
  lines.push(`cost: ${cost}`);
  lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  if (facets) {
    lines.push(`outcome: ${facets.outcome_satisfaction}`);
    if (facets.workflow_pattern) lines.push(`workflow: ${facets.workflow_pattern}`);
  }
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## 会话摘要');
  lines.push('');
  const summaryInsight = insights.find(i => i.type === 'summary');
  if (session.summary) {
    lines.push(session.summary);
  } else if (summaryInsight) {
    lines.push(summaryInsight.summary);
  } else {
    lines.push('（无摘要）');
  }
  lines.push('');

  // Key Insights grouped by type (skip summary — already shown above)
  const typeOrder = ['decision', 'learning', 'technique', 'prompt_quality'];
  const typeLabels: Record<string, string> = {
    decision: '决策',
    learning: '学到',
    technique: '技巧',
    prompt_quality: 'Prompt 质量',
  };

  const nonSummaryInsights = insights.filter(i => i.type !== 'summary');
  if (nonSummaryInsights.length > 0) {
    lines.push('## 关键 Insights');
    lines.push('');

    const byType = new Map<string, InsightRow[]>();
    for (const insight of nonSummaryInsights) {
      if (!byType.has(insight.type)) byType.set(insight.type, []);
      byType.get(insight.type)!.push(insight);
    }

    // Ordered types first
    for (const type of typeOrder) {
      const group = byType.get(type);
      if (!group) continue;
      const label = typeLabels[type] ?? type;
      lines.push(`### ${label}`);
      lines.push('');
      for (const insight of group) {
        lines.push(`**${insight.title}**`);
        lines.push('');
        lines.push(insight.summary);
        if (insight.bullets) {
          try {
            const bullets = JSON.parse(insight.bullets) as string[];
            if (bullets.length > 0) {
              lines.push('');
              for (const b of bullets) lines.push(`- ${b}`);
            }
          } catch { /* ignore */ }
        }
        lines.push('');
      }
    }

    // Any remaining types not in the ordered list
    for (const [type, group] of byType) {
      if (typeOrder.includes(type)) continue;
      lines.push(`### ${type}`);
      lines.push('');
      for (const insight of group) {
        lines.push(`**${insight.title}**`);
        lines.push('');
        lines.push(insight.summary);
        lines.push('');
      }
    }
  }

  // Friction points
  if (facets?.friction_points) {
    try {
      const frictions = JSON.parse(facets.friction_points) as FrictionPoint[];
      if (frictions.length > 0) {
        lines.push('## 摩擦点');
        lines.push('');
        for (const f of frictions) {
          const attrs: string[] = [f.category];
          if (f.attribution) attrs.push(f.attribution);
          if (f.severity) attrs.push(f.severity);
          lines.push(`- **[${attrs.join(' / ')}]** ${f.description}`);
        }
        lines.push('');
      }
    } catch { /* ignore */ }
  }

  // Effective patterns
  if (facets?.effective_patterns) {
    try {
      const patterns = JSON.parse(facets.effective_patterns) as EffectivePattern[];
      if (patterns.length > 0) {
        lines.push('## 亮点');
        lines.push('');
        for (const p of patterns) {
          const attrs: string[] = [p.category];
          if (p.driver) attrs.push(p.driver);
          lines.push(`- **[${attrs.join(' / ')}]** ${p.description}`);
        }
        lines.push('');
      }
    } catch { /* ignore */ }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

async function exportMemoriesAction(options: ExportMemoriesOptions): Promise<void> {
  const gainsDir = options.gainsDir ?? DEFAULT_GAINS_DIR;
  const quiet = options.quiet ?? false;
  const verbose = options.verbose ?? false;

  if (!quiet) console.log(chalk.cyan('\n  Code Insights — Export Memories\n'));

  // Load export state
  const exportedIds = loadExportedIds();

  const db = getDb();

  // Build WHERE conditions
  const conditions: string[] = ['s.deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (options.date) {
    conditions.push("s.started_at >= ? AND s.started_at <= ?");
    params.push(`${options.date}T00:00:00.000Z`, `${options.date}T23:59:59.999Z`);
  }

  if (options.project) {
    conditions.push('(s.project_name LIKE ? OR s.project_path LIKE ?)');
    params.push(`%${options.project}%`, `%${options.project}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  // Fetch all sessions in scope that have insights
  const sessions = db.prepare(`
    SELECT s.id, s.project_name, s.source_tool, s.started_at, s.ended_at,
           s.summary, s.generated_title, s.custom_title, s.primary_model,
           s.estimated_cost_usd, s.message_count, s.tool_call_count
    FROM sessions s
    WHERE s.id IN (SELECT DISTINCT session_id FROM insights)
    AND ${conditions.join(' AND ')}
    ORDER BY s.started_at ASC
  `).all(...params) as SessionRow[];

  if (sessions.length === 0) {
    if (!quiet) console.log(chalk.yellow('  No sessions with insights found.'));
    return;
  }

  // Pre-compute sequence numbers: for every project_name+date+source combo,
  // rank all sessions (including already-exported ones) by started_at.
  // This ensures filenames are stable across incremental runs.
  const seqMap = new Map<string, number>(); // session_id -> seq number
  const groupCounters = new Map<string, number>(); // groupKey -> counter

  for (const s of sessions) {
    const date = s.started_at.slice(0, 10);
    const source = sourceAbbrev(s.source_tool);
    const groupKey = `${s.project_name}:${date}:${source}`;
    const seq = (groupCounters.get(groupKey) ?? 0) + 1;
    groupCounters.set(groupKey, seq);
    seqMap.set(s.id, seq);
  }

  // Determine which sessions to actually write
  const toExport = options.force
    ? sessions
    : sessions.filter(s => !exportedIds.has(s.id));

  if (!quiet) {
    console.log(chalk.dim(`  Total with insights: ${sessions.length}`));
    console.log(chalk.dim(`  Already exported:    ${sessions.length - toExport.length}`));
    console.log(chalk.dim(`  To export:           ${toExport.length}`));
    console.log();
  }

  if (toExport.length === 0) {
    if (!quiet) {
      console.log(chalk.green('  All sessions already exported.'));
      console.log(chalk.dim('  Use --force to re-export.'));
    }
    return;
  }

  let exported = 0;
  let skipped = 0;

  for (const session of toExport) {
    const date = session.started_at.slice(0, 10);
    const source = sourceAbbrev(session.source_tool);
    const seq = seqMap.get(session.id) ?? 1;
    const seqStr = String(seq).padStart(2, '0');
    const shortId = session.id.slice(0, 8);
    const filename = `${date}_${source}_${seqStr}_${shortId}.md`;

    const memoriesDir = join(gainsDir, session.project_name, 'aiws', 'memories');

    if (!existsSync(memoriesDir)) {
      if (verbose) {
        console.log(chalk.dim(`  skip [${session.project_name}]: no memories dir at ${memoriesDir}`));
      }
      skipped++;
      continue;
    }

    const filePath = join(memoriesDir, filename);

    // Fetch facets
    const facets = db.prepare(
      'SELECT outcome_satisfaction, workflow_pattern, friction_points, effective_patterns FROM session_facets WHERE session_id = ?'
    ).get(session.id) as FacetRow | undefined;

    // Fetch insights
    const insights = db.prepare(
      'SELECT type, title, summary, bullets FROM insights WHERE session_id = ? ORDER BY type, created_at ASC'
    ).all(session.id) as InsightRow[];

    const content = buildFileContent(session, facets, insights);
    writeFileSync(filePath, content, 'utf-8');

    exportedIds.add(session.id);
    exported++;

    if (!quiet) {
      console.log(chalk.green(`  ✓ ${session.project_name} / ${filename}`));
      if (verbose) console.log(chalk.dim(`    ${filePath}`));
    }
  }

  // Persist updated state
  if (exported > 0) {
    saveExportedIds(exportedIds);
  }

  if (!quiet) {
    console.log();
    const skippedMsg = skipped > 0 ? ` ${skipped} skipped (no memories dir).` : '';
    console.log(chalk.bold(`  Done. ${exported} exported.${skippedMsg}`));
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export const exportMemoriesCommand = new Command('export-memories')
  .description('Export session memories to project .aiws/memories/ directories')
  .option('-f, --force', 'Re-export all sessions (overwrite existing files)')
  .option('-p, --project <name>', 'Only export sessions from this project')
  .option('-d, --date <date>', 'Only export sessions from this date (YYYY-MM-DD)')
  .option('-q, --quiet', 'Suppress output')
  .option('-v, --verbose', 'Verbose output including file paths')
  .option('--gains-dir <dir>', 'Root gains directory (default: /data/apps/gains)')
  .action(async (options: ExportMemoriesOptions) => {
    await exportMemoriesAction(options);
  });
