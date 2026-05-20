// OpenAI provider implementation (server-side, no browser dependencies)

import type { LLMClient, LLMMessage, LLMResponse, ChatOptions } from '../types.js';
import { flattenContent } from '../types.js';

export function createOpenAIClient(
  apiKey: string,
  model: string,
  baseUrl = 'https://api.openai.com/v1',
  provider = 'openai'
): LLMClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  return {
    provider,
    model,

    async chat(messages: LLMMessage[], options?: ChatOptions): Promise<LLMResponse> {
      const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: options?.signal,
        body: JSON.stringify({
          model,
          // flattenContent converts ContentBlock[] to string; strings pass through unchanged.
          // OpenAI gets automatic prefix caching for free when prefixes match — no extra config needed.
          messages: messages.map(m => ({ role: m.role, content: flattenContent(m.content) })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: 8192,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
        const detail = error.error?.message;
        const label = provider === 'openai' ? 'OpenAI' : provider;
        if (response.status === 401 || response.status === 403) {
          throw new Error(`API Key 无效。请在 \`code-insights config llm\` 中检查 ${label} API Key。${detail ? ` (${detail})` : ''}`);
        }
        if (response.status === 429) {
          throw new Error(`请求频率超限或配额用尽。请检查 ${label} 账户使用情况。${detail ? ` (${detail})` : ''}`);
        }
        if (response.status >= 500) {
          throw new Error(`${label} 服务错误（HTTP ${response.status}），请稍后重试。${detail ? ` (${detail})` : ''}`);
        }
        throw new Error(detail || `${label} API 错误（HTTP ${response.status}）`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        } : undefined,
      };
    },

    estimateTokens(text: string): number {
      // Rough estimate: ~4 characters per token for English
      return Math.ceil(text.length / 4);
    },
  };
}
