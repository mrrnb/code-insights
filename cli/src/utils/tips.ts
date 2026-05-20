import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureConfigDir, getConfigDir } from './config.js';

// Tips stop showing after this many displays per command.
// Five is enough to surface the tip on early uses without becoming annoying.
const MAX_TIPS_PER_COMMAND = 5;

const TIPS_STATE_FILE = '.tips-state.json';

/**
 * Per-command tip arrays. Tips cycle with modulo so they don't repeat
 * in strict sequence once the list wraps — they're educational hints,
 * not a tutorial that must be seen in order.
 */
const TIPS: Record<string, string[]> = {
  stats: [
    '试试 `code-insights stats cost` 查看按会话的成本和 token 分析',
    '试试 `code-insights stats today` 仅查看今日活动',
    '试试 `code-insights stats models` 比较不同 AI 模型的使用情况',
    '试试 `code-insights stats projects` 查看你最常使用的项目',
    '运行 `code-insights dashboard` 在内置控制台中探索你的会话',
  ],
  'stats cost': [
    '使用 `--period 30d` 查看最近 30 天的成本（默认为 7d）',
    '试试 `code-insights stats models` 按模型查看成本分布',
    '试试 `code-insights stats` 查看完整活动概览',
  ],
  'stats today': [
    '试试 `code-insights stats` 查看所有时间的完整活动概览',
    '试试 `code-insights stats cost` 查看今日会话的成本',
  ],
  'stats projects': [
    '使用 `--project <name>` 筛选特定项目的会话',
    '试试 `code-insights stats cost` 查看各项目的成本分布',
  ],
  'stats models': [
    '试试 `code-insights stats cost` 查看每会话成本和模型使用情况',
    '试试 `code-insights stats` 查看包含所有活动的完整概览',
  ],
};

interface TipsState {
  shown: Record<string, number>;
}

/**
 * Load tips state from ~/.code-insights/.tips-state.json.
 * Returns an empty state on any I/O or parse error — tips are non-critical.
 */
function loadTipsState(): TipsState {
  try {
    const file = path.join(getConfigDir(), TIPS_STATE_FILE);
    if (!fs.existsSync(file)) {
      return { shown: {} };
    }
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content) as TipsState;
  } catch {
    return { shown: {} };
  }
}

/**
 * Persist tips state. Silently swallows errors — a failed write just
 * means the same tip might show again next run, which is acceptable.
 */
function saveTipsState(state: TipsState): void {
  try {
    ensureConfigDir();
    const file = path.join(getConfigDir(), TIPS_STATE_FILE);
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch {
    // Non-critical — swallow silently
  }
}

/**
 * Show a rotating contextual tip after a CLI command.
 *
 * Tips are suppressed once a command has accumulated MAX_TIPS_PER_COMMAND
 * displays, so they phase out naturally after the user's first few runs.
 * All state is stored in ~/.code-insights/.tips-state.json.
 *
 * Returns the tip string if one was printed, or null if suppressed.
 */
export function showTip(command: string): string | null {
  try {
    const tips = TIPS[command];

    // No tips defined for this command — nothing to show
    if (!tips || tips.length === 0) {
      return null;
    }

    const state = loadTipsState();
    const count = state.shown[command] ?? 0;

    // User has seen enough tips for this command — stop showing them
    if (count >= MAX_TIPS_PER_COMMAND) {
      return null;
    }

    // Cycle through tips so we don't always repeat the first one
    const tip = tips[count % tips.length];
    const formatted = chalk.gray(`\n  Tip: ${tip}`);

    console.log(formatted);

    state.shown[command] = count + 1;
    saveTipsState(state);

    return formatted;
  } catch {
    // Tips are non-critical — swallow all errors silently
    return null;
  }
}
