import inquirer from 'inquirer';
import chalk from 'chalk';
import { saveConfig, getConfigDir, isConfigured } from '../utils/config.js';
import { getDb } from '../db/client.js';
import { trackEvent, captureError, classifyError } from '../utils/telemetry.js';
import type { ClaudeInsightConfig } from '../types.js';

export interface InitOptions {
  // No options needed for local-first setup
}

/**
 * Initialize Code Insights configuration.
 * Sets up sync preferences and initializes the local SQLite database.
 */
export async function initCommand(_options: InitOptions = {}): Promise<void> {
  console.log(chalk.cyan('\n  Code Insights 初始化\n'));

  if (isConfigured()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: '配置已存在。是否覆盖？',
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('初始化已取消。'));
      return;
    }
  }

  // Save minimal config
  const config: ClaudeInsightConfig = {
    sync: { claudeDir: '~/.claude/projects', excludeProjects: [] },
  };
  saveConfig(config);

  // Initialize database (creates schema if first run)
  try {
    getDb();
    console.log(chalk.green('\n  数据库已初始化，路径：~/.code-insights/data.db'));
  } catch (error) {
    console.log(chalk.red(`\n  数据库初始化失败：${error instanceof Error ? error.message : '未知错误'}`));
    const { error_type, error_message } = classifyError(error);
    trackEvent('cli_init', { success: false, error_type, error_message });
    captureError(error, { command: 'init', error_type });
    process.exit(1);
  }

  console.log(chalk.green('\n  配置已保存！'));
  console.log(chalk.gray(`  配置路径：${getConfigDir()}/config.json`));

  console.log(chalk.cyan('\n  初始化完成！你现在可以运行：\n'));
  console.log(chalk.gray('     code-insights              # 同步并打开控制台'));
  console.log(chalk.gray('     code-insights stats        # 终端分析'));
  console.log(chalk.gray('     code-insights config llm   # 配置 AI 分析（可选）\n'));

  trackEvent('cli_init', { success: true });
}
