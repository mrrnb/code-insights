import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import net from 'net';
import { trackEvent, identifyUser, captureError, classifyError } from '../utils/telemetry.js';
import { printBanner } from '../utils/banner.js';
import { runSync } from './sync.js';
import { loadConfig } from '../utils/config.js';

interface DashboardOptions {
  port: string;
  host?: string;
  open: boolean;
  // Commander's --no-sync flag sets sync=false; default (no flag) is true
  sync?: boolean;
}

/**
 * Check if a port is already in use.
 * - Checks only EADDRINUSE, not other errors (e.g. EACCES for privileged ports).
 * - Waits for the test socket to fully close before resolving, avoiding a TOCTOU
 *   race where the real server tries to bind before the OS releases the port.
 */
function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      server.close();
      resolvePromise(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      // Wait for close callback before resolving so the OS fully releases the port
      server.close(() => resolvePromise(false));
    });
    server.listen(port, host);
  });
}

/**
 * Resolve the dashboard host.
 * Priority: CLI --host > config dashboard.host > default 127.0.0.1
 */
function resolveHost(cliHost?: string): string {
  if (cliHost) return cliHost;
  const config = loadConfig();
  if (config?.dashboard?.host) return config.dashboard.host;
  return '127.0.0.1';
}

/**
 * Start the Code Insights local dashboard server.
 *
 * Loads server/dist/index.js by file URL rather than package name to avoid a
 * circular workspace dependency (server depends on @code-insights/cli, so CLI
 * cannot list @code-insights/server as a build-time dep). pathToFileURL ensures
 * the import works on Windows where absolute paths like C:\... are not valid
 * ESM import specifiers.
 */
export async function dashboardCommand(options: DashboardOptions): Promise<void> {
  // Auto-sync sessions before starting the dashboard so users see fresh data.
  // Skipped with --no-sync. Uses quiet:false so sync progress is visible on first run.
  if (options.sync !== false) {
    try {
      await runSync({ quiet: false });
      void identifyUser();
    } catch (err) {
      // Sync failure is non-fatal — dashboard still opens with whatever data exists
      console.warn(chalk.yellow(`  同步警告：${err instanceof Error ? err.message : String(err)}`));
      console.warn(chalk.dim('  使用 --no-sync 跳过同步，或单独运行 `code-insights sync`。'));
    }
  } else {
    // --no-sync: runSync is skipped so auto-detect doesn't run through that path.
    // Still probe Ollama here so first-time users get configured even without syncing.
    const { autoDetectOllama } = await import('../utils/ollama-detect.js');
    await autoDetectOllama();
  }

  const port = parseInt(options.port, 10);
  const host = resolveHost(options.host);

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(chalk.red(`  无效端口：${options.port}`));
    process.exit(1);
  }

  const inUse = await isPortInUse(port, host);
  if (inUse) {
    console.error(chalk.red(`  端口 ${port} 在 ${host} 上已被占用。`));
    console.error(chalk.dim(`  尝试：code-insights dashboard --port <number> --host <address>`));
    process.exit(1);
  }

  const spinner = ora('正在启动 Code Insights 控制台...').start();

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // cli/dist/commands/dashboard.js -> workspace root is 3 levels up
    const workspaceRoot = resolve(__dirname, '..', '..', '..');
    // cli/dist/commands/dashboard.js -> CLI package root is 2 levels up
    const cliRoot = resolve(__dirname, '..', '..');

    // Try workspace layout first (dev), then npm-installed layout (production)
    let serverEntryPath = resolve(workspaceRoot, 'server', 'dist', 'index.js');
    let staticDir = resolve(workspaceRoot, 'dashboard', 'dist');

    if (!existsSync(serverEntryPath)) {
      serverEntryPath = resolve(cliRoot, 'server-dist', 'index.js');
      staticDir = resolve(cliRoot, 'dashboard-dist');
    }

    if (!existsSync(serverEntryPath)) {
      spinner.fail('未找到控制台服务。');
      console.error(chalk.dim(
        '  从工作区运行：pnpm install && pnpm build\n' +
        '  或全局安装：npm install -g @code-insights/cli\n' +
        '  参考：https://github.com/melagiri/code-insights#development',
      ));
      process.exit(1);
    }

    // Use pathToFileURL so the import specifier is valid on all platforms,
    // including Windows where resolve() returns C:\...\index.js.
    type ServerModule = { startServer: (opts: { port: number; host: string; staticDir: string; openBrowser: boolean }) => Promise<void> };
    const { startServer } = await import(pathToFileURL(serverEntryPath).href) as ServerModule;

    spinner.stop();
    printBanner();
    const displayHost = host === '0.0.0.0' ? '0.0.0.0' : host;
    console.log(chalk.white(`  Dashboard:  `) + chalk.cyan.underline(`http://${displayHost}:${port}`));
    console.log(chalk.dim(`  按 Ctrl+C 停止`));
    console.log('');

    trackEvent('cli_dashboard', { port: port, host, success: true });
    await startServer({ port, host, staticDir, openBrowser: options.open });
  } catch (err) {
    spinner.fail('启动控制台服务失败。');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    const { error_type, error_message } = classifyError(err);
    trackEvent('cli_dashboard', { success: false, error_type, error_message });
    captureError(err, { command: 'dashboard', error_type });
    process.exit(1);
  }
}
