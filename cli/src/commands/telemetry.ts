import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../utils/config.js';
import { isTelemetryEnabled, buildEventPreview, trackEvent, shutdownTelemetry } from '../utils/telemetry.js';
import type { ClaudeInsightConfig } from '../types.js';

/**
 * Minimal config shape used when no config file exists yet but the user
 * explicitly opts in/out of telemetry before running `init`.
 */
const MINIMAL_CONFIG: ClaudeInsightConfig = {
  sync: { claudeDir: '~/.claude/projects', excludeProjects: [] },
};

/**
 * Show telemetry status and a full field-level explanation of what is collected.
 * Also renders a live event preview when telemetry is enabled so users can see
 * exactly what would be sent — no guessing required.
 */
function statusAction(): void {
  const enabled = isTelemetryEnabled();

  console.log(chalk.cyan('\n  遥测\n'));
  console.log(chalk.white(`  状态：${enabled ? chalk.green('已启用') : chalk.yellow('已禁用')}`));

  // Surface environment-variable overrides so users know why the config value
  // might appear to have no effect.
  if (process.env.CODE_INSIGHTS_TELEMETRY_DISABLED === '1') {
    console.log(chalk.gray('  （通过 CODE_INSIGHTS_TELEMETRY_DISABLED 环境变量禁用）'));
  }
  if (process.env.DO_NOT_TRACK === '1') {
    console.log(chalk.gray('  （通过 DO_NOT_TRACK 环境变量禁用）'));
  }

  const preview = buildEventPreview();

  console.log(chalk.white('\n  我们收集的内容（仅此而已）：'));
  const fields: [string, string][] = [
    ['distinct_id', `${preview.distinct_id} (stable hash of hostname+username, never transmitted as PII)`],
    ['cli_version', String(preview.cli_version)],
    ['node_version', String(preview.node_version)],
    ['os', `${preview.os} (${preview.arch})`],
    ['providers', JSON.stringify(preview.installed_providers)],
    ['total_sessions', String(preview.total_sessions)],
    ['has_hook', String(preview.has_hook)],
  ];

  for (const [key, value] of fields) {
    console.log(chalk.gray(`    ${key.padEnd(18)} ${value}`));
  }

  console.log(chalk.white('\n  我们绝不收集的内容：'));
  console.log(chalk.gray('    文件路径、项目名称、会话内容、API keys、'));
  console.log(chalk.gray('    git URL、原始主机名/用户名，或任何可识别个人身份的信息。'));

  // Only show the live event preview when telemetry is on
  if (enabled) {
    console.log(chalk.white('\n  事件预览（当前将发送的内容）：'));
    console.log(chalk.gray(`    ${JSON.stringify(preview, null, 2).split('\n').join('\n    ')}`));
  }

  console.log(chalk.white('\n  如需更改：'));
  console.log(chalk.gray('    code-insights telemetry disable'));
  console.log(chalk.gray('    code-insights telemetry enable'));
  console.log(chalk.gray('    Or set env: CODE_INSIGHTS_TELEMETRY_DISABLED=1\n'));
}

/**
 * Persist telemetry = false to config.
 * If no config file exists yet we write a minimal one — the user clearly has
 * an intent to opt out and we should honour it without forcing them to run init
 * first.
 *
 * Fire telemetry_opted_out BEFORE writing the config — telemetry is still
 * enabled at this point, so the event will actually be sent. Then flush
 * and shut down the client before the process exits.
 */
async function disableAction(): Promise<void> {
  // Fire and flush while telemetry is still enabled
  trackEvent('telemetry_opted_out');
  await shutdownTelemetry();

  const config = loadConfig() ?? { ...MINIMAL_CONFIG };
  config.telemetry = false;
  saveConfig(config);
  console.log(chalk.green('\n  遥测已禁用。\n'));
}

/**
 * Persist telemetry = true to config.
 * Same minimal-config fallback as disableAction.
 *
 * Write config FIRST so telemetry is enabled, then fire telemetry_opted_in.
 */
function enableAction(): void {
  const config = loadConfig() ?? { ...MINIMAL_CONFIG };
  config.telemetry = true;
  saveConfig(config);
  trackEvent('telemetry_opted_in');
  console.log(chalk.green('\n  遥测已启用。\n'));
}

export const telemetryCommand = new Command('telemetry')
  .description('查看或管理匿名使用遥测')
  .action(() => {
    statusAction();
  });

telemetryCommand
  .command('status')
  .description('显示遥测状态及收集的数据')
  .action(() => {
    statusAction();
  });

telemetryCommand
  .command('disable')
  .description('禁用匿名遥测')
  .action(async () => {
    await disableAction();
  });

telemetryCommand
  .command('enable')
  .description('启用匿名遥测')
  .action(() => {
    enableAction();
  });
