// Re-exports from @code-insights/cli/analysis/message-format.
// Moved to CLI package so the CLI can use message formatting for native analysis (--native mode).
export {
  classifyStoredUserMessage,
  formatMessagesForAnalysis,
  formatSessionMetaLine,
} from '@code-insights/cli/analysis/message-format';
