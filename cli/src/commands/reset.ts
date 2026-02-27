import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb, getDbPath } from '../db/client.js';
import { trackEvent } from '../utils/telemetry.js';

const SYNC_STATE_FILE = join(homedir(), '.code-insights', 'sync-state.json');

export const resetCommand = new Command('reset')
  .description('Delete all synced data from the local SQLite database and reset sync state')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log(chalk.red.bold('\n  WARNING: This will permanently delete ALL synced data from your local database!'));
    console.log(chalk.yellow('  Tables to be cleared: projects, sessions, messages, insights, usage_stats\n'));

    if (!options.confirm) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(chalk.cyan('Type "DELETE" to confirm: '), resolve);
      });
      rl.close();

      if (answer !== 'DELETE') {
        console.log(chalk.gray('\nAborted. No data was deleted.'));
        process.exit(0);
      }
    }

    console.log('');

    // Delete SQLite data
    const dbSpinner = ora('Clearing database...').start();
    try {
      const db = getDb();
      // Delete in dependency order (FK constraints)
      db.exec(`
        DELETE FROM insights;
        DELETE FROM messages;
        DELETE FROM sessions;
        DELETE FROM projects;
        DELETE FROM usage_stats;
      `);
      dbSpinner.succeed(`Database cleared (${getDbPath()})`);
    } catch (error) {
      dbSpinner.fail(`Failed to clear database: ${error instanceof Error ? error.message : error}`);
    }

    // Delete local sync state
    const syncSpinner = ora('Removing local sync state...').start();
    try {
      if (existsSync(SYNC_STATE_FILE)) {
        unlinkSync(SYNC_STATE_FILE);
        syncSpinner.succeed('Removed local sync state');
      } else {
        syncSpinner.info('No local sync state file found');
      }
    } catch (error) {
      syncSpinner.fail(`Failed to remove sync state: ${error}`);
    }

    // Collect stats for telemetry before resetting
    try {
      trackEvent('reset', true);
    } catch {
      // non-fatal
    }

    console.log(chalk.green('\n  Reset complete. Run `code-insights sync` to re-sync all sessions.\n'));
    process.exit(0);
  });
