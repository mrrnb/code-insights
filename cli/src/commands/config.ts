import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, saveConfig, isConfigured } from '../utils/config.js';
import { trackEvent } from '../utils/telemetry.js';
import { PROVIDERS, getDefaultModel } from '../constants/llm-providers.js';
import type { ClaudeInsightConfig, LLMProviderConfig } from '../types.js';

/**
 * Show current configuration summary.
 */
function showConfigAction(): void {
  if (!isConfigured()) {
    console.log(chalk.yellow('\n未配置。请运行 `code-insights init` 进行设置。\n'));
    return;
  }

  const config = loadConfig();
  if (!config) {
    console.log(chalk.red('\n加载配置失败。\n'));
    return;
  }

  console.log(chalk.cyan('\n  Code Insights 配置\n'));

  // Sync
  console.log(chalk.white('  同步：'));
  console.log(chalk.gray(`    Claude 目录：${config.sync.claudeDir}`));
  if (config.sync.excludeProjects.length > 0) {
    console.log(chalk.gray(`    排除项目：${config.sync.excludeProjects.join(', ')}`));
  }

  // Dashboard (Phase 3)
  if (config.dashboard?.port) {
    console.log(chalk.white('\n  控制台：'));
    console.log(chalk.gray(`    端口：${config.dashboard.port}`));
  }

  // LLM config
  if (config.dashboard?.llm) {
    const llm = config.dashboard.llm;
    const maskedKey = llm.apiKey && llm.apiKey.length >= 8
      ? llm.apiKey.slice(0, 4) + '...' + llm.apiKey.slice(-4)
      : llm.apiKey ? '***' : '（无）';

    console.log(chalk.white('\n  LLM：'));
    console.log(chalk.gray(`    提供者：${llm.provider}`));
    console.log(chalk.gray(`    模型：  ${llm.model}`));
    if (llm.provider !== 'ollama' && llm.provider !== 'llamacpp') {
      console.log(chalk.gray(`    API Key：${maskedKey}`));
    }
    if (llm.baseUrl) {
      console.log(chalk.gray(`    Base URL：${llm.baseUrl}`));
    }
  }

  // Telemetry — default is enabled; env vars can override at runtime
  console.log(chalk.white('\n  遥测：'));
  const telemetryEnabled = config.telemetry !== false;
  if (process.env.CODE_INSIGHTS_TELEMETRY_DISABLED === '1' || process.env.DO_NOT_TRACK === '1') {
    console.log(chalk.yellow('    状态：已禁用（通过环境变量）'));
  } else {
    console.log(chalk.gray(`    状态：${telemetryEnabled ? '已启用' : '已禁用'}`));
  }

  console.log('');
  trackEvent('cli_config', { subcommand: 'view', success: true });
}

export const configCommand = new Command('config')
  .description('显示 Code Insights 配置')
  .action(() => {
    showConfigAction();
  });

configCommand
  .command('set <key> <value>')
  .description('设置配置值（telemetry）')
  .action((key: string, value: string) => {
    if (key === 'telemetry') {
      if (value !== 'true' && value !== 'false') {
        console.error(chalk.red(`\n无效值 "${value}"。必须为 "true" 或 "false"。\n`));
        process.exit(1);
      }
      const existing = loadConfig();
      if (!existing) {
        saveConfig({
          sync: { claudeDir: '~/.claude/projects', excludeProjects: [] },
          telemetry: value === 'true',
        });
      } else {
        existing.telemetry = value === 'true';
        saveConfig(existing);
      }
      console.log(chalk.green(`\n遥测已${value === 'true' ? '启用' : '禁用'}。\n`));
      trackEvent('cli_config', { subcommand: 'set', success: true });
    } else {
      console.error(chalk.red(`\n未知配置键 "${key}"。可用选项：telemetry。\n`));
      process.exit(1);
    }
  });

// ── config llm ────────────────────────────────────────────────────────────────

const llmCommand = configCommand
  .command('llm')
  .description('配置用于 AI 会话分析的 LLM 提供者')
  .option('--provider <provider>', 'LLM 提供者（openai, anthropic, gemini, ollama, custom）')
  .option('--model <model>', '模型 ID（如 gpt-4o, claude-sonnet-4-20250514）')
  .option('--api-key <key>', '所选提供者的 API key')
  .option('--base-url <url>', '自定义 Base URL（用于 Ollama 或 OpenAI 兼容端点）')
  .option('--show', '显示当前 LLM 配置')
  .action(async (options: {
    provider?: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    show?: boolean;
  }) => {
    // --show: display current LLM config and exit
    if (options.show) {
      const config = loadConfig();
      const llm = config?.dashboard?.llm;

      if (!llm) {
        console.log(chalk.yellow('\nLLM 未配置。请运行 `code-insights config llm` 进行设置。\n'));
        return;
      }

      const maskedKey = llm.apiKey && llm.apiKey.length >= 8
        ? llm.apiKey.slice(0, 4) + '...' + llm.apiKey.slice(-4)
        : llm.apiKey ? '***' : '(无)';

      console.log(chalk.cyan('\n  LLM 配置\n'));
      console.log(chalk.gray(`    提供者：${llm.provider}`));
      console.log(chalk.gray(`    模型：  ${llm.model}`));
      if (llm.provider !== 'ollama' && llm.provider !== 'llamacpp') {
        console.log(chalk.gray(`    API Key：${maskedKey}`));
      }
      if (llm.baseUrl) {
        console.log(chalk.gray(`    Base URL：${llm.baseUrl}`));
      }
      console.log('');
      return;
    }

    // Non-interactive: all required fields provided via flags
    if (options.provider && options.model) {
      const validProviders = PROVIDERS.map(p => p.id);
      if (!validProviders.includes(options.provider as LLMProviderConfig['provider'])) {
        console.error(chalk.red(`\n无效提供者 "${options.provider}"。必须为以下之一：${validProviders.join(', ')}\n`));
        process.exit(1);
      }

      const providerInfo = PROVIDERS.find(p => p.id === options.provider);
      if (providerInfo?.requiresApiKey && !options.apiKey) {
        console.error(chalk.red(`\n提供者 "${options.provider}" 需要 API key。请使用 --api-key <key>\n`));
        process.exit(1);
      }

      const llmConfig: LLMProviderConfig = {
        provider: options.provider as LLMProviderConfig['provider'],
        model: options.model,
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
      };

      saveLLMConfig(llmConfig);
      console.log(chalk.green(`\nLLM 已配置：${options.provider} / ${options.model}\n`));
      return;
    }

    // Interactive flow
    await runInteractiveLLMConfig();
  });

/**
 * Interactive LLM configuration wizard.
 */
async function runInteractiveLLMConfig(): Promise<void> {
  const existing = loadConfig()?.dashboard?.llm;

  console.log(chalk.cyan('\n  LLM 配置\n'));
  console.log(chalk.gray('  配置用于会话分析的 AI 提供者。\n'));

  // Step 1: Select provider
  const { provider } = await inquirer.prompt<{ provider: LLMProviderConfig['provider'] }>([
    {
      type: 'list',
      name: 'provider',
      message: '选择 LLM 提供者：',
      choices: PROVIDERS.map(p => ({
        name: `${p.name}${p.requiresApiKey ? '' : '（无需 API key）'}`,
        value: p.id,
      })),
      default: existing?.provider ?? 'ollama',
    },
  ]);

  const providerInfo = PROVIDERS.find(p => p.id === provider);
  if (!providerInfo) {
    console.error(chalk.red('\n未找到提供者信息。中止操作。\n'));
    process.exit(1);
  }

  // Step 2: Select or enter model
  const { model } = await inquirer.prompt<{ model: string }>([
    provider === 'custom'
      ? {
          type: 'input',
          name: 'model',
          message: '模型 ID（如 gpt-4.1、deepseek-chat、kimi-k2）：',
          default: existing?.model ?? '',
          validate: (value: string) => value.trim() ? true : '模型 ID 为必填项',
        }
      : {
          type: 'list',
          name: 'model',
          message: '选择模型：',
          choices: providerInfo.models.map(m => ({
            name: `${m.name}${m.description ? ` — ${m.description}` : ''}`,
            value: m.id,
          })),
          default: existing?.model ?? getDefaultModel(provider),
        },
  ]);

  const llmConfig: LLMProviderConfig = { provider, model };

  // Step 3: API key (if required)
  if (providerInfo.requiresApiKey) {
    const maskedExisting = existing?.apiKey && existing.apiKey.length >= 8
      ? `${existing.apiKey.slice(0, 4)}...${existing.apiKey.slice(-4)}`
      : undefined;

    const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
      {
        type: 'password',
        name: 'apiKey',
        message: `API key${maskedExisting ? `（当前：${maskedExisting}，留空保持不变）` : ''}：`,
        mask: '*',
        validate: (val: string) => {
          if (!val && !existing?.apiKey) {
            return `${providerInfo.name} 需要 API key`;
          }
          return true;
        },
      },
    ]);

    // Preserve existing key if blank input
    if (apiKey) {
      llmConfig.apiKey = apiKey;
    } else if (existing?.apiKey) {
      llmConfig.apiKey = existing.apiKey;
    }
  }

  // Step 4: Base URL (Ollama or custom)
  if (provider === 'ollama' || provider === 'custom') {
    const { baseUrl } = await inquirer.prompt<{ baseUrl: string }>([
      {
        type: 'input',
        name: 'baseUrl',
        message: provider === 'ollama'
          ? 'Ollama URL（留空使用默认值 http://localhost:11434）：'
          : 'OpenAI 兼容的 Base URL（必填，如 https://api.openai.com/v1）：',
        default: existing?.baseUrl ?? (provider === 'ollama' ? '' : 'https://api.openai.com/v1'),
        validate: (value: string) => {
          if (provider === 'custom' && !value.trim()) return '自定义提供者必须填写 Base URL';
          return true;
        },
      },
    ]);

    if (baseUrl && (provider !== 'ollama' || baseUrl !== 'http://localhost:11434')) {
      llmConfig.baseUrl = baseUrl;
    }
  }

  if (provider === 'llamacpp') {
    const { baseUrl } = await inquirer.prompt<{ baseUrl: string }>([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'llama-server URL（留空使用默认值 http://localhost:8080）：',
        default: existing?.baseUrl ?? '',
      },
    ]);

    if (baseUrl && baseUrl !== 'http://localhost:8080') {
      llmConfig.baseUrl = baseUrl;
    }
    // No API key prompt for llamacpp — llama-server runs locally without authentication
  }

  saveLLMConfig(llmConfig);

  console.log(chalk.green(`\nLLM 已配置：${providerInfo.name} / ${model}\n`));

  if (providerInfo.apiKeyLink && !llmConfig.apiKey) {
    console.log(chalk.dim(`  获取 API key：${providerInfo.apiKeyLink}\n`));
  }
}

/**
 * Save LLM config into the dashboard.llm field of the CLI config file.
 */
function saveLLMConfig(llmConfig: LLMProviderConfig): void {
  const existing: ClaudeInsightConfig = loadConfig() ?? {
    sync: { claudeDir: '~/.claude/projects', excludeProjects: [] },
  };
  existing.dashboard = { ...existing.dashboard, llm: llmConfig };
  saveConfig(existing);
}

// Suppress unused variable warning — llmCommand is registered via .command() side-effect
void llmCommand;
