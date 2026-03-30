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
    console.log(chalk.yellow('  Dashboard server is not running.'));
    console.log(chalk.dim('  Start it with: code-insights dashboard'));
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
        console.log(chalk.yellow('  LLM provider is not configured.'));
        console.log(chalk.dim('  Configure it with: code-insights config llm'));
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

  const spinner = ora({ text: `Analyzing ${sessionId}...`, indent: 2 }).start();
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
              spinner.text = data.message || `Analyzing ${sessionId}...`;
            } else if (currentEvent === 'complete') {
              result = { insightCount: data.insightCount ?? 0 };
              spinner.succeed(`Analysis complete for ${sessionId} (${result.insightCount} insights)`);
            } else if (currentEvent === 'error') {
              spinner.fail(data.error || `Analysis failed for ${sessionId}`);
              throw new Error(data.error || `Analysis failed for ${sessionId}`);
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
    console.log(chalk.red('  Provide at least one --session-id.'));
    console.log();
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  await checkServer(baseUrl);
  await checkLlmConfigured(baseUrl);

  console.log();
  console.log(chalk.cyan(`  Preparing to analyze ${sessionIds.length} session${sessionIds.length !== 1 ? 's' : ''}.`));

  if (!options.yes) {
    const confirmed = await confirmPrompt('  Continue?');
    if (!confirmed) {
      console.log(chalk.dim('  Aborted.'));
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
      console.log(chalk.yellow(`  Failed ${sessionId}: ${message}`));
    }
  }

  console.log();
  console.log(chalk.bold('  Summary'));
  console.log(chalk.green(`    ${succeeded} sessions analyzed`));
  if (failed > 0) {
    console.log(chalk.yellow(`    ${failed} sessions failed`));
  }
  console.log();
}

export const analyzeCommand = new Command('analyze')
  .description('Run LLM session analysis for specific sessions')
  .requiredOption('--session-id <ids...>', 'One or more session IDs to analyze')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(analyzeAction);
