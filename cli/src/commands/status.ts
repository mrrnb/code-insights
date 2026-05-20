import chalk from 'chalk';
import { loadSyncState } from '../utils/config.js';
import { getDb, getDbPath } from '../db/client.js';
import { getProjects } from '../db/read.js';
import { getAllProviders } from '../providers/registry.js';
import { trackEvent, captureError, classifyError } from '../utils/telemetry.js';

/**
 * Show Code Insights status
 */
export async function statusCommand(): Promise<void> {
  console.log(chalk.cyan('\n  Code Insights 状态\n'));

  try {
    // Check database
    console.log(chalk.white('数据库：'));
    try {
      getDb(); // ensures migrations run
      const dbPath = getDbPath();
      console.log(chalk.green(`  已连接：${dbPath}`));

      const projects = getProjects();
      if (projects.length > 0) {
        const totalSessions = projects.reduce((sum, p) => sum + p.session_count, 0);
        console.log(chalk.gray(`  ${projects.length} 个项目，${totalSessions} 个会话已同步`));
      } else {
        console.log(chalk.gray('  尚未同步会话。运行 `code-insights sync`'));
      }
    } catch (error) {
      console.log(chalk.red(`  数据库错误：${error instanceof Error ? error.message : '未知错误'}`));
    }

    // Discover local sessions across all providers
    console.log(chalk.white('\n本地会话：'));
    const providers = getAllProviders();
    let totalLocal = 0;
    for (const provider of providers) {
      try {
        const files = await provider.discover();
        if (files.length > 0) {
          console.log(chalk.green(`  ${provider.getProviderName()}: ${files.length} sessions`));
          totalLocal += files.length;
        }
      } catch {
        // Provider not available on this machine (e.g., no Cursor installed)
      }
    }
    if (totalLocal === 0) {
      console.log(chalk.yellow('  未从任何工具发现会话'));
    }

    // Check sync state
    console.log(chalk.white('\n同步状态：'));
    const syncState = loadSyncState();
    if (syncState.lastSync) {
      const lastSync = new Date(syncState.lastSync);
      const syncedFiles = Object.keys(syncState.files).length;
      console.log(chalk.green(`  上次同步：${lastSync.toLocaleString()}`));
      console.log(chalk.gray(`  ${syncedFiles} 个文件已跟踪`));
    } else {
      console.log(chalk.yellow('  从未同步'));
      console.log(chalk.gray('  运行 `code-insights sync` 进行同步'));
    }

    // Synced projects list
    try {
      const projects = getProjects();
      if (projects.length > 0) {
        console.log(chalk.white('\n已同步项目：'));
        for (const project of projects.slice(0, 5)) {
          console.log(chalk.gray(`  ${project.name}（${project.session_count} 个会话）`));
        }
        if (projects.length > 5) {
          console.log(chalk.gray(`  ... 及其他 ${projects.length - 5} 个项目`));
        }
      }
    } catch {
      // DB not ready yet
    }

    console.log('');
    trackEvent('cli_status', { success: true });
  } catch (error) {
    const { error_type, error_message } = classifyError(error);
    trackEvent('cli_status', { success: false, error_type, error_message });
    captureError(error, { command: 'status', error_type });
    console.error(chalk.red(`  状态命令失败：${error instanceof Error ? error.message : '未知错误'}`));
  }
}
