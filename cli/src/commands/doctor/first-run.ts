import chalk from 'chalk';
import { getAllProviders } from '../../providers/registry.js';

/**
 * Render a step-by-step setup guide for first-time users.
 * Shown instead of the normal check list when: never synced + 0 sessions + no hook.
 */
export async function renderFirstRun(version: string): Promise<void> {
  // Count discoverable sessions across all providers
  let sessionCount = 0;
  for (const provider of getAllProviders()) {
    try {
      const files = await provider.discover();
      sessionCount += files.length;
    } catch {
      // Provider not available
    }
  }

  console.log(chalk.cyan(`\n  Code Insights — Doctor  v${version}`));
  console.log(chalk.dim('  ────────────────────────────────────────────────'));
  console.log('');
  console.log('  看起来你刚开始使用。以下是操作步骤：');
  console.log('');

  // Step 1
  console.log(chalk.white('  第 1 步 — 同步你的会话'));
  console.log(chalk.cyan('    code-insights sync'));
  if (sessionCount > 0) {
    console.log(chalk.dim(`    发现 ${sessionCount} 个会话可导入。`));
  }
  console.log('');

  // Step 2
  console.log(chalk.white('  第 2 步 — 打开控制台'));
  console.log(chalk.cyan('    code-insights dashboard'));
  console.log('');

  // Step 3
  console.log(chalk.white('  第 3 步 — 自动同步未来的会话（推荐）'));
  console.log(chalk.cyan('    code-insights install-hook'));
  console.log('');

  // Step 4
  console.log(chalk.white('  第 4 步 — 设置 AI 分析（可选）'));
  console.log(chalk.cyan('    code-insights config set-provider ollama llama3.3   # 免费，本地运行'));
  console.log('');

  console.log(chalk.dim('  ────────────────────────────────────────────────'));
  console.log('  同步后再次运行 `code-insights doctor` 以验证配置。');
  console.log('');
}
