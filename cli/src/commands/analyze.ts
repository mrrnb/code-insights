import { Command } from 'commander';
import { createInterface } from 'readline';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';

interface AnalyzeOptions {
  sessionId?: string[];
  yes?: boolean;
}

function confirmPrompt(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function getBaseUrl(): string {
  const config = loadConfig();
  const port = config?.dashboard?.port || 7890;
  return `http://localhost:${port}`;
}

async function checkServer(baseUrl: string): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/health`);
  } catch {
    console.log(chalk.yellow('  控制台服务未运行。'));
    console.log(chalk.dim('  启动方式：code-insights dashboard'));
    console.log();
    process.exit(1);
  }
}

async function checkLlmConfigured(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/api/config/llm`);
    if (res.ok) {
      const data = await res.json() as { provider?: string; model?: string };
      if (!data.provider || !data.model) {
        console.log(chalk.yellow('  LLM 提供者未配置。'));
        console.log(chalk.dim('  配置方式：code-insights config llm'));
        console.log();
        process.exit(1);
      }
    }
  } catch {
    // Let the analysis endpoint report configuration errors.
  }
}

async function analyzeSessionStream(baseUrl: string, sessionId: string): Promise<{ insightCount: number }> {
  const res = await fetch(`${baseUrl}/api/analysis/session/stream?sessionId=${encodeURIComponent(sessionId)}`);

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Server error ${res.status}: ${text}`);
  }

  if (!res.body) {
    throw new Error('No response body');
  }

  const spinner = ora({ text: `正在分析 ${sessionId}...`, indent: 2 }).start();
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let result = { insightCount: 0 };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
        } else if (line === '' && currentEvent && currentData) {
          try {
            const data = JSON.parse(currentData) as { message?: string; error?: string; insightCount?: number };

            if (currentEvent === 'progress') {
              spinner.text = data.message || `正在分析 ${sessionId}...`;
            } else if (currentEvent === 'complete') {
              result = { insightCount: data.insightCount ?? 0 };
              spinner.succeed(`${sessionId} 分析完成（${result.insightCount} 条洞察）`);
            } else if (currentEvent === 'error') {
              spinner.fail(data.error || `${sessionId} 分析失败`);
              throw new Error(data.error || `${sessionId} 分析失败`);
            }
          } catch (error) {
            if (error instanceof Error) throw error;
          }

          currentEvent = '';
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

async function analyzeAction(options: AnalyzeOptions): Promise<void> {
  const sessionIds = Array.from(new Set(options.sessionId ?? []));

  if (sessionIds.length === 0) {
    console.log(chalk.red('  请提供至少一个 --session-id。'));
    console.log();
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  await checkServer(baseUrl);
  await checkLlmConfigured(baseUrl);

  console.log();
  console.log(chalk.cyan(`  准备分析 ${sessionIds.length} 个会话。`));

  if (!options.yes) {
    const confirmed = await confirmPrompt('  继续？');
    if (!confirmed) {
      console.log(chalk.dim('  已中止。'));
      console.log();
      return;
    }
  }

  console.log();

  let succeeded = 0;
  let failed = 0;

  for (const sessionId of sessionIds) {
    try {
      await analyzeSessionStream(baseUrl, sessionId);
      succeeded++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.yellow(`  ${sessionId} 失败：${message}`));
    }
  }

  console.log();
  console.log(chalk.bold('  摘要'));
  console.log(chalk.green(`    ${succeeded} 个会话已分析`));
  if (failed > 0) {
    console.log(chalk.yellow(`    ${failed} 个会话分析失败`));
  }
  console.log();
}

export const analyzeCommand = new Command('analyze')
  .description('对指定会话运行 LLM 分析')
  .requiredOption('--session-id <ids...>', '一个或多个要分析的会话 ID')
  .option('-y, --yes', '跳过确认提示')
  .action(analyzeAction);
