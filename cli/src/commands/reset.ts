import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, unlinkSync } from 'fs';
import { getDb, getDbPath } from '../db/client.js';
import { getSyncStatePath } from '../utils/config.js';
import { trackEvent, captureError, classifyError } from '../utils/telemetry.js';

export const resetCommand = new Command('reset')
  .description('删除本地 SQLite 数据库中的所有同步数据并重置同步状态')
  .option('--confirm', '跳过确认提示')
  .action(async (options) => {
    console.log(chalk.red.bold('\n  警告：这将永久删除本地数据库中的所有同步数据！'));
    console.log(chalk.yellow('  将清空的表：projects, sessions, messages, insights, session_facets, reflect_snapshots, usage_stats\n'));

    if (!options.confirm) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(chalk.cyan('输入 "DELETE" 确认：'), resolve);
      });
      rl.close();

      if (answer !== 'DELETE') {
        console.log(chalk.gray('\n已中止。没有数据被删除。'));
        process.exit(0);
      }
    }

    console.log('');

    // Delete SQLite data — all 5 DELETEs wrapped in a single transaction.
    // If any DELETE fails, the transaction rolls back atomically and we do NOT
    // proceed to delete the sync state file (which would leave them out of sync).
    const dbSpinner = ora('正在清空数据库...').start();
    try {
      const db = getDb();
      const clearAll = db.transaction(() => {
        // Delete in dependency order (FK constraints)
        db.prepare('DELETE FROM insights').run();
        db.prepare('DELETE FROM session_facets').run();
        db.prepare('DELETE FROM reflect_snapshots').run();
        db.prepare('DELETE FROM messages').run();
        db.prepare('DELETE FROM sessions').run();
        db.prepare('DELETE FROM projects').run();
        db.prepare('DELETE FROM usage_stats').run();
      });
      clearAll();
      dbSpinner.succeed(`数据库已清空（${getDbPath()}）`);
    } catch (error) {
      dbSpinner.fail(`清空数据库失败：${error instanceof Error ? error.message : error}`);
      console.error(chalk.red('\n已中止。同步状态未被删除，以避免不一致。'));
      console.error(chalk.dim('如问题持续，请运行 `code-insights doctor`。'));
      const { error_type, error_message } = classifyError(error);
      trackEvent('cli_reset', { success: false, error_type, error_message });
      captureError(error, { command: 'reset', error_type });
      process.exit(1);
    }

    // Delete local sync state — only reached if DB clear succeeded
    const syncStatePath = getSyncStatePath();
    const syncSpinner = ora('正在删除本地同步状态...').start();
    try {
      if (existsSync(syncStatePath)) {
        unlinkSync(syncStatePath);
        syncSpinner.succeed('已删除本地同步状态');
      } else {
        syncSpinner.info('未找到本地同步状态文件');
      }
    } catch (error) {
      syncSpinner.fail(`删除同步状态失败：${error}`);
    }

    // Collect stats for telemetry before resetting
    try {
      trackEvent('cli_reset', { success: true });
    } catch {
      // non-fatal
    }

    console.log(chalk.green('\n  重置完成。运行 `code-insights sync` 重新同步所有会话。\n'));
    process.exit(0);
  });
