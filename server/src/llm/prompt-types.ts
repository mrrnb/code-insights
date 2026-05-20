// Re-exports from @code-insights/cli/analysis/prompt-types.
// Moved to CLI package so the CLI can use these types for native analysis (--native mode).
export type {
  SQLiteMessageRow,
  SessionMetadata,
  ContentBlock,
  AnalysisResponse,
  ParseError,
  ParseResult,
  PromptQualityFinding,
  PromptQualityTakeaway,
  PromptQualityDimensionScores,
  PromptQualityResponse,
} from '@code-insights/cli/analysis/prompt-types';
