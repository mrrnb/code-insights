// Re-exports from @code-insights/cli/analysis/normalize-utils.
// Moved to CLI package so the CLI can use these utilities for native analysis (--native mode).
export type { NormalizerConfig } from '@code-insights/cli/analysis/normalize-utils';
export { levenshtein, normalizeCategory, kebabToTitleCase } from '@code-insights/cli/analysis/normalize-utils';
