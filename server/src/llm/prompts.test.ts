import { describe, it, expect } from 'vitest';
import {
  formatMessagesForAnalysis,
  generateSessionAnalysisPrompt,
  parseAnalysisResponse,
  parsePromptQualityResponse,
  SESSION_ANALYSIS_SYSTEM_PROMPT,
  PROMPT_QUALITY_SYSTEM_PROMPT,
  type SQLiteMessageRow,
} from './prompts.js';

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

function makeMessage(overrides: Partial<SQLiteMessageRow> = {}): SQLiteMessageRow {
  return {
    id: 'msg-1',
    session_id: 'sess-1',
    type: 'user',
    content: 'Hello world',
    thinking: null,
    tool_calls: '',
    tool_results: '',
    usage: null,
    timestamp: '2025-06-15T10:00:00Z',
    parent_id: null,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────
// formatMessagesForAnalysis
// ──────────────────────────────────────────────────────

describe('formatMessagesForAnalysis', () => {
  it('produces readable text with role labels', () => {
    const messages = [
      makeMessage({ type: 'user', content: 'Fix the bug' }),
      makeMessage({ id: 'msg-2', type: 'assistant', content: 'Done!' }),
    ];
    const result = formatMessagesForAnalysis(messages);
    expect(result).toContain('### User#0:');
    expect(result).toContain('Fix the bug');
    expect(result).toContain('### Assistant#0:');
    expect(result).toContain('Done!');
  });

  it('increments user and assistant indices independently', () => {
    const messages = [
      makeMessage({ type: 'user', content: 'msg 1' }),
      makeMessage({ id: 'msg-2', type: 'assistant', content: 'msg 2' }),
      makeMessage({ id: 'msg-3', type: 'user', content: 'msg 3' }),
      makeMessage({ id: 'msg-4', type: 'assistant', content: 'msg 4' }),
    ];
    const result = formatMessagesForAnalysis(messages);
    expect(result).toContain('User#0');
    expect(result).toContain('Assistant#0');
    expect(result).toContain('User#1');
    expect(result).toContain('Assistant#1');
  });

  it('includes tool call names when present', () => {
    const messages = [
      makeMessage({
        type: 'assistant',
        content: 'Let me read the file',
        tool_calls: JSON.stringify([{ name: 'Read' }, { name: 'Write' }]),
      }),
    ];
    const result = formatMessagesForAnalysis(messages);
    expect(result).toContain('[Tools used: Read, Write]');
  });

  it('includes thinking content when present', () => {
    const messages = [
      makeMessage({
        type: 'assistant',
        content: 'The answer is 42',
        thinking: 'I need to calculate this carefully',
      }),
    ];
    const result = formatMessagesForAnalysis(messages);
    expect(result).toContain('[Thinking: I need to calculate this carefully]');
  });

  it('includes tool results when present', () => {
    const messages = [
      makeMessage({
        type: 'assistant',
        content: 'Read the file',
        tool_results: JSON.stringify([{ output: 'file contents here' }]),
      }),
    ];
    const result = formatMessagesForAnalysis(messages);
    expect(result).toContain('[Tool results: file contents here]');
  });

  it('handles empty messages array', () => {
    const result = formatMessagesForAnalysis([]);
    expect(result).toBe('');
  });

  it('handles malformed JSON in tool_calls gracefully', () => {
    const messages = [
      makeMessage({
        type: 'assistant',
        content: 'oops',
        tool_calls: 'not valid json',
      }),
    ];
    // Should not throw
    const result = formatMessagesForAnalysis(messages);
    expect(result).toContain('oops');
    // No [Tools used:] since parse failed
    expect(result).not.toContain('[Tools used:');
  });
});

// ──────────────────────────────────────────────────────
// generateSessionAnalysisPrompt
// ──────────────────────────────────────────────────────

describe('generateSessionAnalysisPrompt', () => {
  it('includes project name in the prompt', () => {
    const result = generateSessionAnalysisPrompt('my-app', null, 'conversation text');
    expect(result).toContain('Project: my-app');
  });

  it('includes session summary when provided', () => {
    const result = generateSessionAnalysisPrompt('my-app', 'Fixed a critical bug', 'conversation text');
    expect(result).toContain('Session Summary: Fixed a critical bug');
  });

  it('omits session summary line when null', () => {
    const result = generateSessionAnalysisPrompt('my-app', null, 'conversation text');
    expect(result).not.toContain('Session Summary:');
  });

  it('includes the formatted messages', () => {
    const result = generateSessionAnalysisPrompt('my-app', null, '### User#0:\nHello');
    expect(result).toContain('### User#0:\nHello');
  });
});

// ──────────────────────────────────────────────────────
// parseAnalysisResponse
// ──────────────────────────────────────────────────────

describe('parseAnalysisResponse', () => {
  it('parses valid JSON in <json> tags', () => {
    const response = `<json>
{
  "summary": {
    "title": "Implemented auth",
    "content": "Added login and logout",
    "bullets": ["Login flow", "Logout flow"]
  },
  "decisions": [],
  "learnings": []
}
</json>`;
    const result = parseAnalysisResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary.title).toBe('Implemented auth');
    expect(result.data.summary.bullets).toHaveLength(2);
    expect(result.data.decisions).toEqual([]);
    expect(result.data.learnings).toEqual([]);
  });

  it('parses raw JSON without tags', () => {
    const response = `{
  "summary": { "title": "Test", "content": "Content", "bullets": [] },
  "decisions": [],
  "learnings": []
}`;
    const result = parseAnalysisResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary.title).toBe('Test');
  });

  it('returns error for completely malformed response', () => {
    const result = parseAnalysisResponse('This is not JSON at all');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.error_type).toBe('no_json_found');
  });

  it('returns error for JSON missing required summary.title', () => {
    const response = '<json>{ "summary": { "content": "no title" }, "decisions": [], "learnings": [] }</json>';
    const result = parseAnalysisResponse(response);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.error_type).toBe('invalid_structure');
  });

  it('defaults decisions and learnings to empty arrays when missing', () => {
    const response = '<json>{ "summary": { "title": "Test", "content": "c", "bullets": [] } }</json>';
    const result = parseAnalysisResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.decisions).toEqual([]);
    expect(result.data.learnings).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────
// parsePromptQualityResponse
// ──────────────────────────────────────────────────────

describe('parsePromptQualityResponse', () => {
  it('parses valid response with findings and takeaways', () => {
    const response = `<json>{
      "efficiency_score": 85,
      "message_overhead": 2,
      "assessment": "Good prompting style overall",
      "takeaways": [
        {
          "type": "improve",
          "category": "vague-request",
          "label": "Add file path to requests",
          "message_ref": "User#3",
          "original": "fix the bug",
          "better_prompt": "Fix the null pointer in cli/src/commands/sync.ts line 42",
          "why": "The original lacked enough detail to act on without guessing"
        }
      ],
      "findings": [
        {
          "category": "vague-request",
          "type": "deficit",
          "description": "User#3 asked to fix a bug without specifying file, function, or error message",
          "message_ref": "User#3",
          "impact": "medium",
          "confidence": 80
        }
      ],
      "dimension_scores": {
        "context_provision": 70,
        "request_specificity": 65,
        "scope_management": 90,
        "information_timing": 80,
        "correction_quality": 75
      }
    }</json>`;
    const result = parsePromptQualityResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.efficiency_score).toBe(85);
    expect(result.data.takeaways).toHaveLength(1);
    expect(result.data.findings).toHaveLength(1);
    expect(result.data.findings[0].category).toBe('vague-request');
    expect(result.data.dimension_scores.scope_management).toBe(90);
  });

  it('clamps efficiency_score to 0-100 range', () => {
    const response = '<json>{ "efficiency_score": 150, "message_overhead": 0, "assessment": "ok", "takeaways": [], "findings": [], "dimension_scores": { "context_provision": 50, "request_specificity": 50, "scope_management": 50, "information_timing": 50, "correction_quality": 50 } }</json>';
    const result = parsePromptQualityResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.efficiency_score).toBe(100);
  });

  it('defaults missing dimension_scores to 50s', () => {
    const response = '<json>{ "efficiency_score": 75, "message_overhead": 0, "assessment": "ok", "takeaways": [], "findings": [] }</json>';
    const result = parsePromptQualityResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.dimension_scores.context_provision).toBe(50);
    expect(result.data.dimension_scores.correction_quality).toBe(50);
  });

  it('accepts empty arrays (well-prompted session)', () => {
    const response = '<json>{ "efficiency_score": 95, "message_overhead": 0, "assessment": "Excellent session", "takeaways": [], "findings": [], "dimension_scores": { "context_provision": 95, "request_specificity": 90, "scope_management": 95, "information_timing": 95, "correction_quality": 75 } }</json>';
    const result = parsePromptQualityResponse(response);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.takeaways).toHaveLength(0);
    expect(result.data.findings).toHaveLength(0);
  });

  it('returns error for missing efficiency_score', () => {
    const response = '<json>{ "assessment": "no score" }</json>';
    const result = parsePromptQualityResponse(response);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.error_type).toBe('invalid_structure');
  });

  it('returns error for completely invalid response', () => {
    const result = parsePromptQualityResponse('not json');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.error_type).toBe('no_json_found');
  });
});

// ──────────────────────────────────────────────────────
// System prompt constants
// ──────────────────────────────────────────────────────

describe('System prompt constants', () => {
  it('SESSION_ANALYSIS_SYSTEM_PROMPT is a non-empty string', () => {
    expect(typeof SESSION_ANALYSIS_SYSTEM_PROMPT).toBe('string');
    expect(SESSION_ANALYSIS_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('PROMPT_QUALITY_SYSTEM_PROMPT is a non-empty string', () => {
    expect(typeof PROMPT_QUALITY_SYSTEM_PROMPT).toBe('string');
    expect(PROMPT_QUALITY_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});
