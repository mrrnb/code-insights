import { Command } from 'commander';
import { createInterface } from 'readline';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { getCurrentIsoWeek } from '../utils/date-utils.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function confirmPrompt(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function getBaseUrl(): string {
  const config = loadConfig();
  const port = config?.dashboard?.port || 7890;
  return `http://localhost:${port}`;
}

async function checkServer(baseUrl: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/health`);
  } catch {
    console.log(chalk.yellow('  控制台服务未运行。'));
    console.log(chalk.dim('  启动方式：code-insights dashboard'));
    console.log();
    process.exit(1);
  }
}

async function checkLlmConfigured(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/api/config/llm`);
    if (res.ok) {
      const data = await res.json() as { provider?: string; model?: string };
      if (!data.provider || !data.model) {
        console.log(chalk.yellow('  LLM 提供者未配置。'));
        console.log(chalk.dim('  配置方式：code-insights config llm'));
        console.log();
        process.exit(1);
      }
    }
  } catch {
    // If config endpoint fails, let the backfill endpoint handle it
  }
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

async function fetchWithSSE(url: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Server error ${res.status}: ${text}`);
  }

  if (!res.body) throw new Error('No response body');

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let result: Record<string, unknown> = {};

  const spinner = ora({ text: '正在启动...', indent: 2 }).start();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentEvent && currentData) {
          try {
            const data = JSON.parse(currentData) as Record<string, unknown>;

            if (currentEvent === 'progress') {
              spinner.text = (data.message as string) || '处理中...';
            } else if (currentEvent === 'complete') {
              spinner.succeed('分析完成');
              result = data;
            } else if (currentEvent === 'error') {
              spinner.fail((data.error as string) || '生成失败');
            }
          } catch {
            // Skip malformed SSE events (e.g., truncated JSON from network issues)
          }

          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

async function backfillBatch(
  baseUrl: string,
  sessionIds: string[],
  offset: number,
  total: number,
  concurrency: number,
  signal?: AbortSignal
): Promise<{ completed: number; failed: number }> {
  return backfillBatchToEndpoint(baseUrl, '/api/facets/backfill', sessionIds, offset, total, concurrency, signal);
}

async function backfillPqBatch(
  baseUrl: string,
  sessionIds: string[],
  offset: number,
  total: number,
  concurrency: number,
  signal?: AbortSignal
): Promise<{ completed: number; failed: number }> {
  return backfillBatchToEndpoint(baseUrl, '/api/facets/backfill-pq', sessionIds, offset, total, concurrency, signal);
}

async function backfillBatchToEndpoint(
  baseUrl: string,
  endpoint: string,
  sessionIds: string[],
  offset: number,
  total: number,
  concurrency: number,
  signal?: AbortSignal
): Promise<{ completed: number; failed: number }> {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // force=true so outdated sessions (which already have facets) are re-processed.
    // Missing sessions are unaffected — the guard only fires when a row exists.
    body: JSON.stringify({ sessionIds, force: true, concurrency }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Server error ${res.status}: ${text}`);
  }
  if (!res.body) throw new Error('No response body');

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let result = { completed: 0, failed: 0 };

  const spinner = ora({ text: `  正在回填 ${offset + 1}-${offset + sessionIds.length} / ${total}...`, indent: 2 }).start();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentEvent && currentData) {
          try {
            const data = JSON.parse(currentData) as Record<string, unknown>;
            if (currentEvent === 'progress') {
              const processed = (data.completed as number) + (data.failed as number);
              const concurrency = data.concurrency as number | undefined;
              const active = data.activeWorkers as number | undefined;
              const suffix = concurrency && concurrency > 1 ? ` (${active ?? '?'}/${concurrency} 并发)` : '';
              spinner.text = `  正在回填 ${offset + processed + 1} / ${total}${suffix}...`;
            } else if (currentEvent === 'complete') {
              result = { completed: data.completed as number, failed: data.failed as number };
              spinner.succeed(`  批次完成：${result.completed} 条已提取，${result.failed} 条失败`);
            }
          } catch { /* skip malformed */ }
          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const ISO_WEEK_RE = /^(\d{4})-W(\d{2})$/;

async function reflectAction(options: {
  section?: string;
  week?: string;
  project?: string;
}): Promise<void> {
  const baseUrl = getBaseUrl();
  const week = options.week || getCurrentIsoWeek();

  // Validate --week format: must be YYYY-WNN with year 2020-2100 and week number 1-53
  if (options.week) {
    const match = ISO_WEEK_RE.exec(options.week);
    const year = match ? parseInt(match[1], 10) : 0;
    const weekNum = match ? parseInt(match[2], 10) : 0;
    if (!match || weekNum < 1 || weekNum > 53 || year < 2020 || year > 2100) {
      console.log(chalk.red('  无效的周格式："' + options.week + '"'));
      console.log(chalk.dim('  使用 YYYY-WNN 格式，年份 2020-2100，如 2026-W10'));
      console.log();
      process.exit(1);
    }
  }

  await checkServer(baseUrl);

  console.log(chalk.dim(`  正在为 ${week} 生成反思报告...`));

  // Check minimum session threshold
  const checkParams = new URLSearchParams();
  checkParams.set('period', week);
  if (options.project) checkParams.set('project', options.project);
  const aggRes = await fetch(`${baseUrl}/api/facets/aggregated?${checkParams.toString()}`);
  if (aggRes.ok) {
    const agg = await aggRes.json() as { totalSessions: number; totalAllSessions: number };
    if (agg.totalSessions < 8) {
      console.log(chalk.yellow(`  已分析的会话不足以进行有意义的综合。`));
      console.log(chalk.dim(`  本周至少需要 8 个带 facets 的会话（当前 ${agg.totalSessions} 个）。`));
      console.log(chalk.dim(`  请运行会话分析以从更多会话中提取 facets。`));
      console.log();
      process.exit(1);
    }

    if (agg.totalAllSessions > 0 && agg.totalSessions / agg.totalAllSessions < 0.5) {
      console.log(chalk.yellow(`  注意：${agg.totalAllSessions} 个会话中仅 ${agg.totalSessions} 个已分析。`));
      console.log(chalk.dim(`  结果可能无法代表你的完整模式。`));
      console.log();
    }
  }

  const body: Record<string, unknown> = {
    period: week,
  };
  if (options.section) {
    body.sections = [options.section];
  }
  if (options.project) {
    body.project = options.project;
  }

  console.log();
  const data = await fetchWithSSE(`${baseUrl}/api/reflect/generate`, body);

  // Display results summary
  const results = data.results as Record<string, Record<string, unknown>> | undefined;
  if (!results) {
    console.log(chalk.dim('  未生成结果。'));
    return;
  }

  console.log();

  // Friction & Wins summary
  const frictionWins = results['friction-wins'];
  if (frictionWins) {
    console.log(chalk.bold('  摩擦与收获'));
    if (frictionWins.narrative) {
      const lines = String(frictionWins.narrative).split('\n');
      for (const line of lines) {
        console.log(chalk.dim('  ') + line);
      }
    }
    console.log();
  }

  // Rules & Hooks summary
  const rulesSkills = results['rules-skills'];
  if (rulesSkills) {
    console.log(chalk.bold('  规则与 Hooks'));
    const rules = rulesSkills.claudeMdRules as Array<{ rule: string }> | undefined;
    if (rules && rules.length > 0) {
      console.log(chalk.dim('  CLAUDE.md 规则：'));
      for (const r of rules) {
        console.log(`    ${chalk.cyan('→')} ${r.rule}`);
      }
    }
    const hooks = rulesSkills.hookConfigs as Array<{ event: string; command: string }> | undefined;
    if (hooks && hooks.length > 0) {
      console.log(chalk.dim('  Hooks：'));
      for (const h of hooks) {
        console.log(`    ${chalk.cyan('→')} ${h.event}: ${h.command}`);
      }
    }
    console.log();
  }

  // Working Style summary
  const workingStyle = results['working-style'];
  if (workingStyle) {
    console.log(chalk.bold('  工作风格'));
    if (workingStyle.narrative) {
      const lines = String(workingStyle.narrative).split('\n');
      for (const line of lines) {
        console.log(chalk.dim('  ') + line);
      }
    }
    console.log();
  }

  console.log(chalk.dim('  查看完整结果：code-insights dashboard → Patterns'));
  console.log();
}

const BACKFILL_BATCH_SIZE = 200;

async function backfillAction(options: {
  period?: string;
  project?: string;
  dryRun?: boolean;
  sessionId?: string[];
  yes?: boolean;
  concurrency?: number;
}): Promise<void> {
  const baseUrl = getBaseUrl();
  await checkServer(baseUrl);
  await checkLlmConfigured(baseUrl);

  let missingCount = 0;
  let outdatedCount = 0;
  let sessionIds: string[] = [];

  if (options.sessionId && options.sessionId.length > 0) {
    sessionIds = Array.from(new Set(options.sessionId));
    missingCount = sessionIds.length;
  } else {
    const params = new URLSearchParams();
    params.set('period', options.period || 'all');
    if (options.project) params.set('project', options.project);

    const missingRes = await fetch(`${baseUrl}/api/facets/missing?${params.toString()}`);
    if (!missingRes.ok) {
      const text = await missingRes.text().catch(() => missingRes.statusText);
      console.log(chalk.red(`  Error: ${text}`));
      process.exit(1);
    }

    const missingData = await missingRes.json() as { sessionIds: string[]; count: number };
    const outdatedRes = await fetch(`${baseUrl}/api/facets/outdated?${params.toString()}`);
    if (!outdatedRes.ok) {
      const text = await outdatedRes.text().catch(() => outdatedRes.statusText);
      console.log(chalk.red(`  Error fetching outdated sessions: ${text}`));
      process.exit(1);
    }

    const outdatedData = await outdatedRes.json() as { sessionIds: string[]; count: number };
    missingCount = missingData.count;
    outdatedCount = outdatedData.count;

    const mergedSet = new Set([...missingData.sessionIds, ...outdatedData.sessionIds]);
    sessionIds = Array.from(mergedSet);
  }

  const count = sessionIds.length;

  console.log();
  if (count === 0) {
    console.log(chalk.green('  所有已分析的会话都已有最新的 facets。'));
    console.log();
    return;
  }

  if (options.sessionId && options.sessionId.length > 0) {
    console.log(chalk.cyan(`  正在处理 ${count} 个手动选定的会话。`));
  } else if (missingCount > 0 && outdatedCount > 0) {
    console.log(chalk.cyan(`  发现 ${missingCount} 个缺少 facets 的会话和 ${outdatedCount} 个分析过期的会话。共处理 ${count} 个。`));
  } else if (missingCount > 0) {
    console.log(chalk.cyan(`  发现 ${missingCount} 个缺少 facets 的会话。`));
  } else {
    console.log(chalk.cyan(`  发现 ${outdatedCount} 个分析过期的会话。`));
  }
  console.log(chalk.dim(`  将进行 ${count} 次 LLM 调用。`));

  if (options.dryRun) {
    console.log(chalk.dim('  （试运行 — 未做任何更改）'));
    console.log();
    return;
  }

  // Confirm before proceeding — each call costs tokens
  if (!options.yes) {
    const confirmed = await confirmPrompt('  继续？');
    if (!confirmed) {
      console.log(chalk.dim('  已中止。'));
      console.log();
      return;
    }
  }

  console.log();

  let totalCompleted = 0;
  let totalFailed = 0;

  for (let i = 0; i < sessionIds.length; i += BACKFILL_BATCH_SIZE) {
    const batch = sessionIds.slice(i, i + BACKFILL_BATCH_SIZE);
    const { completed, failed } = await backfillBatch(baseUrl, batch, i, sessionIds.length, options.concurrency ?? 1);
    totalCompleted += completed;
    totalFailed += failed;
  }

  console.log();
  console.log(chalk.bold('  摘要'));
  console.log(chalk.green(`    ${totalCompleted} 个会话已回填`));
  if (totalFailed > 0) {
    console.log(chalk.yellow(`    ${totalFailed} 个会话失败`));
  }
  console.log();
}

async function backfillPqAction(options: {
  period?: string;
  project?: string;
  dryRun?: boolean;
  concurrency?: number;
}): Promise<void> {
  const baseUrl = getBaseUrl();
  await checkServer(baseUrl);
  await checkLlmConfigured(baseUrl);

  const params = new URLSearchParams();
  params.set('period', options.period || 'all');
  if (options.project) params.set('project', options.project);

  const missingRes = await fetch(`${baseUrl}/api/facets/missing-pq?${params.toString()}`);
  if (!missingRes.ok) {
    const text = await missingRes.text().catch(() => missingRes.statusText);
    console.log(chalk.red(`  Error: ${text}`));
    process.exit(1);
  }

  const { sessionIds: missingIds, count: missingCount } = await missingRes.json() as { sessionIds: string[]; count: number };

  const outdatedRes = await fetch(`${baseUrl}/api/facets/outdated-pq?${params.toString()}`);
  if (!outdatedRes.ok) {
    const text = await outdatedRes.text().catch(() => outdatedRes.statusText);
    console.log(chalk.red(`  Error fetching outdated PQ sessions: ${text}`));
    process.exit(1);
  }

  const { sessionIds: outdatedIds, count: outdatedCount } = await outdatedRes.json() as { sessionIds: string[]; count: number };

  // Merge and deduplicate — a session could appear in both lists if it has an outdated PQ row
  // and also got queued via missing detection (shouldn't happen but defensive merge).
  const mergedSet = new Set([...missingIds, ...outdatedIds]);
  const sessionIds = Array.from(mergedSet);
  const count = sessionIds.length;

  console.log();
  if (count === 0) {
    console.log(chalk.green('  所有会话都已有最新的 PQ 分析。'));
    console.log();
    return;
  }

  if (missingCount > 0 && outdatedCount > 0) {
    console.log(chalk.cyan(`  发现 ${missingCount} 个缺少 PQ 分析的会话和 ${outdatedCount} 个分析过期的会话。共处理 ${count} 个。`));
  } else if (missingCount > 0) {
    console.log(chalk.cyan(`  发现 ${missingCount} 个缺少 PQ 分析的会话。`));
  } else {
    console.log(chalk.cyan(`  发现 ${outdatedCount} 个 PQ 分析过期的会话。`));
  }
  console.log(chalk.dim(`  将进行 ${count} 次 LLM 调用。`));

  if (options.dryRun) {
    console.log(chalk.dim('  （试运行 — 未做任何更改）'));
    console.log();
    return;
  }

  // Confirm before proceeding — each call costs tokens
  const confirmed = await confirmPrompt('  继续？');
  if (!confirmed) {
    console.log(chalk.dim('  已中止。'));
    console.log();
    return;
  }

  console.log();

  let totalCompleted = 0;
  let totalFailed = 0;

  for (let i = 0; i < sessionIds.length; i += BACKFILL_BATCH_SIZE) {
    const batch = sessionIds.slice(i, i + BACKFILL_BATCH_SIZE);
    const { completed, failed } = await backfillPqBatch(baseUrl, batch, i, sessionIds.length, options.concurrency ?? 1);
    totalCompleted += completed;
    totalFailed += failed;
  }

  console.log();
  console.log(chalk.bold('  摘要'));
  console.log(chalk.green(`    ${totalCompleted} 个会话已分析`));
  if (totalFailed > 0) {
    console.log(chalk.yellow(`    ${totalFailed} 个会话失败`));
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

const backfillCommand = new Command('backfill')
  .description('为缺少模式数据的会话提取 facets')
  .option('-p, --period <period>', '时间范围：7d, 30d, 90d, all', 'all')
  .option('--session-id <ids...>', '直接回填指定的会话 ID')
  .option('--dry-run', '显示数量但不执行回填')
  .option('-y, --yes', '跳过确认提示')
  .option('--prompt-quality', '运行 Prompt 质量分析而非 facet 提取')
  .option('-c, --concurrency <n>', '并发 worker 数量（1-10）', '1')
  .action(function (this: Command) {
    const options = this.optsWithGlobals() as {
      period?: string;
      project?: string;
      dryRun?: boolean;
      sessionId?: string[];
      yes?: boolean;
      promptQuality?: boolean;
      concurrency?: string;
    };
    const parsedOptions = {
      ...options,
      concurrency: Math.min(Math.max(1, parseInt(options.concurrency ?? '1', 10) || 1), 10),
    };
    if (options.promptQuality) {
      return backfillPqAction(parsedOptions);
    }
    return backfillAction(parsedOptions);
  });

export const reflectCommand = new Command('reflect')
  .description('生成跨会话分析（摩擦、规则、工作风格）')
  .option('--section <name>', '生成指定部分：friction-wins, rules-skills, working-style')
  .option('--week <week>', '要反思的 ISO 周（如 2026-W10），默认为当前周')
  .option('--project <name>', '限定为单个项目')
  .addCommand(backfillCommand)
  .action(reflectAction);
