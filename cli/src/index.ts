#!/usr/bin/env node

import { readFileSync } from 'fs';
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { syncCommand, getTrivialSessions, pruneTrivialSessions } from './commands/sync.js';
import { statusCommand } from './commands/status.js';
import { installHookCommand, uninstallHookCommand } from './commands/install-hook.js';
import { openCommand } from './commands/open.js';
import { dashboardCommand } from './commands/dashboard.js';
import { resetCommand } from './commands/reset.js';
import { statsCommand } from './commands/stats/index.js';
import { configCommand } from './commands/config.js';
import { telemetryCommand } from './commands/telemetry.js';
import { reflectCommand } from './commands/reflect.js';
import { analyzeCommand } from './commands/analyze.js';
import { memoriesCommand } from './commands/memories.js';
import { exportMemoriesCommand } from './commands/export-memories.js';
import { insightsCommand, insightsCheckCommand } from './commands/insights.js';
import { sessionEndCommand } from './commands/session-end.js';
import { buildQueueCommand } from './commands/queue.js';
import { doctorCommand } from './commands/doctor/index.js';
import { showTelemetryNoticeIfNeeded } from './utils/telemetry.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

const program = new Command();

program
  .name('code-insights')
  .description('AI 编程会话分析 — 同步、统计与洞察')
  .version(pkg.version);

program
  .command('init')
  .description('初始化 Code Insights（创建本地数据库）')
  .action(initCommand);

const syncCmd = program
  .command('sync')
  .description('同步 AI 编程会话到本地 SQLite 数据库')
  .option('-f, --force', '强制重新同步所有会话（同时恢复已隐藏的会话）')
  .option('-p, --project <name>', '仅同步指定项目的会话')
  .option('-s, --source <name>', '仅同步指定工具的会话（如 claude-code、cursor）')
  .option('--dry-run', '预览同步内容，不做实际更改')
  .option('-q, --quiet', '静默输出（适用于 hook）')
  .option('-v, --verbose', '显示来自 provider 的诊断警告')
  .option('--regenerate-titles', '重新生成所有会话的标题')
  .action(syncCommand);

syncCmd
  .command('prune')
  .description('软删除消息数 ≤2 的会话（无内容的废弃会话）')
  .action(async () => {
    const chalk = (await import('chalk')).default;
    const { default: inquirer } = await import('inquirer');
    console.log(chalk.cyan('\n  Code Insights — 清理\n'));

    const sessions = getTrivialSessions();
    if (sessions.length === 0) {
      console.log(chalk.green('  没有发现可清理的会话。'));
      return;
    }

    console.log(chalk.white(`  发现 ${sessions.length} 个消息数 ≤2 的会话：\n`));
    for (const s of sessions) {
      const label = s.title ?? chalk.dim('（无标题）');
      console.log(`  ${chalk.dim('·')} ${label} ${chalk.dim(`[${s.project_name}, ${s.message_count} 条消息]`)}`);
    }
    console.log('');

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `软删除这 ${sessions.length} 个会话？（可通过 sync --force 恢复）`,
        default: false,
      },
    ]);

    if (!confirmed) {
      console.log(chalk.yellow('\n  已取消。没有会话被隐藏。'));
      return;
    }

    const { deleted } = pruneTrivialSessions(sessions.map((s) => s.id));
    console.log(chalk.green(`\n  已隐藏 ${deleted} 个会话。`));
    console.log(chalk.dim('  使用 code-insights sync --force 恢复已隐藏的会话。'));
  });

program
  .command('status')
  .description('显示 Code Insights 状态和统计信息')
  .action(statusCommand);

program
  .command('install-hook')
  .description('安装 Claude Code SessionEnd hook，实现自动同步和分析')
  .action(() => installHookCommand());

program
  .command('uninstall-hook')
  .description('移除 Claude Code hooks（同步和分析）')
  .action(uninstallHookCommand);

program
  .command('doctor')
  .description('检查 Code Insights 安装状态')
  .option('--fix', '自动应用安全的幂等修复')
  .option('--verbose', '显示跳过项的探测路径')
  .option('--json', '机器可读的 JSON 输出')
  .action(async (opts) => {
    await doctorCommand({ fix: opts.fix, verbose: opts.verbose, json: opts.json });
  });

program
  .command('open')
  .description('在浏览器中打开本地控制台')
  .option('--project', '打开时筛选当前项目')
  .action(openCommand);

program
  .command('dashboard')
  .description('启动 Code Insights 控制台服务并在浏览器中打开')
  .option('-p, --port <number>', '端口号', String(7890))
  .option('-H, --host <address>', '监听地址（默认 127.0.0.1，0.0.0.0 允许外部访问）')
  .option('--no-open', '不自动打开浏览器')
  .option('--no-sync', '启动前跳过自动会话同步')
  .action(dashboardCommand);

program.addCommand(resetCommand);
program.addCommand(statsCommand);
program.addCommand(configCommand);
program.addCommand(telemetryCommand);
program.addCommand(reflectCommand);
program.addCommand(analyzeCommand);
program.addCommand(memoriesCommand);
program.addCommand(exportMemoriesCommand);


// session-end command — single SessionEnd hook entry point (sync + enqueue + spawn worker)
program
  .command('session-end')
  .description('SessionEnd hook：同步会话、入队分析、启动后台 worker')
  .option('--native', '使用 claude -p 进行分析（默认：true）')
  .option('-s, --source <tool>', '来源工具标识符（默认：claude-code）')
  .option('-q, --quiet', '静默输出')
  .option('--model <model>', '用于原生分析的模型（默认：sonnet）')
  .action(async (opts) => {
    await sessionEndCommand({ native: opts.native ?? true, quiet: opts.quiet, source: opts.source, model: opts.model });
  });

// queue command suite — manage the analysis_queue
program.addCommand(buildQueueCommand());

// insights command — analyze a session using native claude -p or configured LLM
const insightsCmd = program
  .command('insights [session_id]')
  .description('使用 AI 分析会话 — 提取洞察和 Prompt 质量评分')
  .option('--native', '使用 claude -p（你的 Claude 订阅，无需 API key）')
  .option('--hook', '从 stdin 读取会话上下文（用于 Claude Code SessionEnd hook）')
  .option('-s, --source <tool>', '来源工具标识符（默认：claude-code）')
  .option('--force', '即使已在当前会话长度下分析过也重新分析')
  .option('-q, --quiet', '静默输出')
  .option('--model <model>', '用于原生分析的模型（默认：sonnet）')
  .action(async (sessionId: string | undefined, opts) => {
    await insightsCommand(sessionId, opts);
  });

insightsCmd
  .command('check')
  .description('检查最近 N 天内未分析的会话')
  .option('--days <n>', '回溯天数', '7')
  .option('-q, --quiet', '机器可读输出（仅输出数量）')
  .option('--analyze', '依次处理所有发现的会话')
  .option('-c, --concurrency <n>', '并发 worker 数量（1-10，配合 --analyze 使用）', '1')
  .option('--force', '强制重新分析已有洞察的会话（覆盖）')
  .action(async (opts) => {
    await insightsCheckCommand({
      days: opts.days ? parseInt(opts.days, 10) : 7,
      quiet: opts.quiet,
      analyze: opts.analyze,
      concurrency: opts.concurrency ? parseInt(opts.concurrency, 10) : 1,
      force: opts.force,
    });
  });

// Default action: running `code-insights` with no arguments opens the dashboard.
// Dashboard auto-syncs sessions first, giving "1 command to value" on first run.
program.action(async () => {
  await dashboardCommand({ port: '7890', open: true, sync: true });
});

// Show one-time telemetry disclosure before any command runs
// Skip for --version/-V and --help/-h since those commands don't need it
const isVersionOrHelp = process.argv.some(arg => ['--version', '-V', '--help', '-h'].includes(arg));
if (!isVersionOrHelp) {
  showTelemetryNoticeIfNeeded();
}

program.parse();
