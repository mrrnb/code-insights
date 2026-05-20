/**
 * queue command suite — manage the analysis_queue.
 *
 * Subcommands:
 *   status          Show queue state (pending/processing/completed/failed counts)
 *   process         Process next pending item (foreground)
 *   retry [id]      Reset failed items to pending
 *     --all         Reset all failed items
 *   prune           Remove old completed/failed items
 *     --days <n>    Default: 7
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { getQueueStatus, resetFailed, pruneCompleted } from '../db/queue.js';
import { processQueue } from '../analysis/queue-worker.js';

// ── queue status ──────────────────────────────────────────────────────────────

export async function queueStatusCommand(opts: { quiet?: boolean } = {}): Promise<void> {
  const { quiet = false } = opts;
  const status = getQueueStatus();

  if (quiet) {
    process.stdout.write(JSON.stringify({
      pending: status.pending,
      processing: status.processing,
      completed: status.completed,
      failed: status.failed,
    }) + '\n');
    return;
  }

  console.log(chalk.cyan('\n  分析队列状态\n'));
  console.log(chalk.white(`  待处理：  ${status.pending}`));
  console.log(chalk.white(`  处理中：  ${status.processing}`));
  console.log(chalk.white(`  已完成：  ${status.completed}`));
  if (status.failed > 0) {
    console.log(chalk.red(`  失败：    ${status.failed}`));
  } else {
    console.log(chalk.white(`  失败：    ${status.failed}`));
  }

  if (status.items.length > 0) {
    console.log(chalk.cyan('\n  活动项：\n'));
    for (const item of status.items) {
      const statusColor = item.status === 'failed' ? chalk.red : chalk.yellow;
      console.log(
        `  ${statusColor(item.status.padEnd(12))} ${chalk.dim(item.session_id)} ` +
        `${chalk.dim(`(attempt ${item.attempt_count}/${item.max_attempts})`)}`
      );
      if (item.error_message && item.status === 'failed') {
        console.log(chalk.dim(`               ${item.error_message}`));
      }
    }
    console.log('');
  }
}

// ── queue process ─────────────────────────────────────────────────────────────

export async function queueProcessCommand(opts: { quiet?: boolean; model?: string } = {}): Promise<void> {
  const { quiet = false } = opts;
  const log = quiet ? () => {} : console.log.bind(console);

  try {
    const count = await processQueue({ quiet, model: opts.model });
    if (count === 0) {
      log(chalk.dim('[Code Insights] 队列中没有待处理项'));
    } else {
      log(chalk.green(`[Code Insights] 已处理 ${count} 项`));
    }
  } catch (error) {
    if (!quiet) {
      console.error(chalk.red(`[Code Insights] 队列处理失败：${error instanceof Error ? error.message : String(error)}`));
    }
    process.exit(1);
  }
}

// ── queue retry ───────────────────────────────────────────────────────────────

export async function queueRetryCommand(
  sessionId: string | undefined,
  opts: { all?: boolean; quiet?: boolean } = {}
): Promise<void> {
  const { quiet = false } = opts;

  if (!sessionId && !opts.all) {
    console.error(chalk.red('请提供要重试的会话 ID，或使用 --all 重试所有失败项'));
    process.exit(1);
  }

  const count = resetFailed(sessionId);
  if (!quiet) {
    if (count === 0) {
      console.log(chalk.yellow('[Code Insights] 未找到需要重试的失败项'));
    } else {
      console.log(chalk.green(`[Code Insights] 已将 ${count} 个失败项重置为待处理`));
    }
  }
}

// ── queue prune ───────────────────────────────────────────────────────────────

export async function queuePruneCommand(opts: { days?: number; quiet?: boolean } = {}): Promise<void> {
  const { days = 7, quiet = false } = opts;
  const count = pruneCompleted(days);
  if (!quiet) {
    if (count === 0) {
      console.log(chalk.dim(`[Code Insights] 没有超过 ${days} 天的项需要移除`));
    } else {
      console.log(chalk.green(`[Code Insights] 已移除 ${count} 个超过 ${days} 天的项`));
    }
  }
}

// ── Commander command tree ────────────────────────────────────────────────────

export function buildQueueCommand(): Command {
  const queueCmd = new Command('queue')
    .description('管理分析队列');

  queueCmd
    .command('status')
    .description('显示队列状态（待处理/处理中/已完成/失败计数）')
    .option('-q, --quiet', '机器可读的 JSON 输出')
    .action((opts) => queueStatusCommand({ quiet: opts.quiet }));

  queueCmd
    .command('process')
    .description('处理待处理的队列项（前台）')
    .option('-q, --quiet', '静默输出')
    .option('--model <model>', '用于原生分析的模型（默认：sonnet）')
    .action((opts) => queueProcessCommand({ quiet: opts.quiet, model: opts.model }));

  queueCmd
    .command('retry [session_id]')
    .description('将失败项重置为待处理以重试')
    .option('--all', '重置所有失败项')
    .option('-q, --quiet', '静默输出')
    .action((sessionId: string | undefined, opts) =>
      queueRetryCommand(sessionId, { all: opts.all, quiet: opts.quiet })
    );

  queueCmd
    .command('prune')
    .description('移除超过 N 天的已完成/失败项')
    .option('--days <n>', '天数阈值（默认：7）', '7')
    .option('-q, --quiet', '静默输出')
    .action((opts) =>
      queuePruneCommand({ days: parseInt(opts.days, 10), quiet: opts.quiet })
    );

  return queueCmd;
}
