import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { trackEvent, captureError, classifyError } from '../utils/telemetry.js';
import {
  HOOKS_FILE,
  CLI_ENTRY,
  type ClaudeSettings,
  type HookConfig,
  getHookCommand,
  hookAlreadyInstalled,
  isCodeInsightsHookCommand,
} from '../utils/hooks-utils.js';

const CLAUDE_SETTINGS_DIR = path.join(os.homedir(), '.claude');

/**
 * Remove any existing Code Insights Stop hooks (v4.8.x migration).
 * v4.8.x installed a Stop hook for sync; v4.9+ uses a single SessionEnd hook.
 * Called on install so re-running install-hook cleans up the old setup.
 */
function removeStopHooks(settings: ClaudeSettings): boolean {
  if (!settings.hooks?.Stop) return false;
  const before = settings.hooks.Stop.length;
  settings.hooks.Stop = settings.hooks.Stop.filter(
    (h) => !h.hooks.some((hook) => isCodeInsightsHookCommand(getHookCommand(hook)))
  );
  if (settings.hooks.Stop.length === 0) {
    delete settings.hooks.Stop;
  }
  return settings.hooks.Stop === undefined
    ? before > 0
    : settings.hooks.Stop.length < before;
}

/**
 * Install the single Code Insights SessionEnd hook.
 *
 * v4.9+ uses one SessionEnd hook that does sync + enqueue + worker spawn.
 * Running install-hook again removes the old Stop hook (v4.8.x hygiene) and
 * installs a fresh session-end hook.
 */
export async function installHookCommand(): Promise<void> {
  console.log(chalk.cyan('\n安装 Code Insights Hook\n'));

  const sessionEndCommand = `node ${CLI_ENTRY} session-end --native -q`;

  console.log(chalk.gray('这将添加一个 Claude Code SessionEnd hook：\n'));
  console.log(chalk.white('  SessionEnd hook — 会话结束时自动同步和分析'));
  console.log(chalk.gray('                    使用你的 Claude 订阅，无需 API key。\n'));

  try {
    // Load existing settings
    let settings: ClaudeSettings = {};
    if (fs.existsSync(HOOKS_FILE)) {
      try {
        const content = fs.readFileSync(HOOKS_FILE, 'utf-8');
        settings = JSON.parse(content);
      } catch {
        console.log(chalk.yellow('无法解析现有的 settings.json，将创建新文件。'));
      }
    }

    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Clean up v4.8.x Stop hook if present (sync hook from old two-hook system).
    const removedStop = removeStopHooks(settings);
    if (removedStop) {
      console.log(chalk.dim('  已移除 v4.8.x 旧版 Stop hook'));
    }

    // Install the new unified SessionEnd hook (skip if already installed)
    if (!settings.hooks.SessionEnd) {
      settings.hooks.SessionEnd = [];
    }

    if (!hookAlreadyInstalled(settings.hooks.SessionEnd)) {
      const newHook: HookConfig = {
        // timeout: 10s is enough — session-end exits immediately after spawn
        hooks: [{ type: 'command', command: sessionEndCommand, timeout: 10000 }],
      };
      settings.hooks.SessionEnd.push(newHook);
    }

    // Write settings
    fs.mkdirSync(CLAUDE_SETTINGS_DIR, { recursive: true });
    fs.writeFileSync(HOOKS_FILE, JSON.stringify(settings, null, 2));

    console.log(chalk.green('Hook 安装成功！'));
    console.log(chalk.gray(`\n配置已保存至：${HOOKS_FILE}`));
    console.log(chalk.cyan('\n工作原理：'));
    console.log(chalk.white('  会话结束时，Code Insights 会自动同步并将其加入分析队列。'));
    console.log(chalk.white('  分析在后台运行 — 结束会话时不会产生延迟。'));
    console.log(chalk.dim('\n  查看队列状态：code-insights queue status'));

    trackEvent('cli_install_hook', {
      success: true,
      hook_types: 'session-end',
      sync_installed: false,
      analysis_installed: true,
    });
  } catch (error) {
    console.log(chalk.red(`Hook 安装失败：${error instanceof Error ? error.message : '未知错误'}`));
    const { error_type, error_message } = classifyError(error);
    trackEvent('cli_install_hook', { success: false, error_type, error_message });
    captureError(error, { command: 'install_hook', error_type });
  }
}

/**
 * Uninstall Code Insights hooks.
 * Handles both v4.9+ (SessionEnd session-end) and v4.8.x (Stop sync + SessionEnd insights --hook).
 */
export async function uninstallHookCommand(): Promise<void> {
  console.log(chalk.cyan('\n卸载 Code Insights Hooks\n'));

  if (!fs.existsSync(HOOKS_FILE)) {
    console.log(chalk.yellow('未找到 hooks 文件，无需卸载。'));
    return;
  }

  try {
    const content = fs.readFileSync(HOOKS_FILE, 'utf-8');
    const settings: ClaudeSettings = JSON.parse(content);

    if (!settings.hooks?.Stop && !settings.hooks?.SessionEnd) {
      console.log(chalk.yellow('未找到 Code Insights hooks，无需卸载。'));
      return;
    }

    // Remove all Code Insights hooks (Stop and SessionEnd, any command format)
    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(
        (h) => !h.hooks.some((hook) => isCodeInsightsHookCommand(getHookCommand(hook)))
      );
      if (settings.hooks.Stop.length === 0) {
        delete settings.hooks.Stop;
      }
    }

    if (settings.hooks.SessionEnd) {
      settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
        (h) => !h.hooks.some((hook) => isCodeInsightsHookCommand(getHookCommand(hook)))
      );
      if (settings.hooks.SessionEnd.length === 0) {
        delete settings.hooks.SessionEnd;
      }
    }

    // Clean up empty hooks object
    if (settings.hooks && Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    fs.writeFileSync(HOOKS_FILE, JSON.stringify(settings, null, 2));

    console.log(chalk.green('Hooks 卸载成功！'));
  } catch (error) {
    console.log(chalk.red('Hook 卸载失败：'));
    console.error(error instanceof Error ? error.message : 'Unknown error');
  }
}
