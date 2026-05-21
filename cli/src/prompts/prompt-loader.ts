// Prompt loader — reads prompt templates from prompts/ directory with fallback to built-in defaults.
// Templates support ${variable} interpolation for dynamic values.
//
// Lookup order:
//   1. <project-root>/prompts/<name>.md  (user-customizable, checked into git)
//   2. Built-in default (compiled into the binary)

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve project root from this file's location:
// cli/src/prompts/prompt-loader.ts -> project root is ../../../
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROMPTS_DIR = path.join(PROJECT_ROOT, 'prompts');

/**
 * Load a prompt template from the config directory.
 * Falls back to the built-in default if the file doesn't exist.
 *
 * @param name - Template name (without extension), e.g. 'session-analysis'
 * @param vars - Variables to interpolate in the template
 * @param fallback - Built-in default template string
 */
export function loadPrompt(name: string, vars?: Record<string, string>, fallback?: string): string {
  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  let template: string;

  try {
    template = fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error(`提示词模板未找到：${filePath}（且无内置默认值）`);
  }

  if (!vars) return template;

  return template.replace(/\$\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`提示词模板 ${name}.md 中的变量 \${${key}} 未提供值`);
    }
    return value;
  });
}

/**
 * Check if a custom prompt file exists for the given name.
 */
export function hasCustomPrompt(name: string): boolean {
  return fs.existsSync(path.join(PROMPTS_DIR, `${name}.md`));
}

/**
 * Get the prompts directory path (for display or initialization).
 */
export function getPromptsDir(): string {
  return PROMPTS_DIR;
}

/**
 * Initialize the prompts directory with default templates.
 * Copies built-in defaults to ~/.code-insights/prompts/ so users can customize them.
 */
export function initPromptsDir(): void {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true, mode: 0o700 });
  }
}
