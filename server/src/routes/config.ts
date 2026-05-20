import { Hono } from 'hono';
import { loadConfig, saveConfig } from '@code-insights/cli/utils/config';
import type { ClaudeInsightConfig, LLMProviderConfig } from '@code-insights/cli/types';
import { loadLLMConfig, testLLMConfig } from '../llm/client.js';
import { discoverOllamaModels } from '../llm/providers/ollama.js';
import { discoverLlamaCppModels } from '../llm/providers/llamacpp.js';

const app = new Hono();

const VALID_PROVIDERS = ['openai', 'anthropic', 'gemini', 'ollama', 'llamacpp', 'custom'] as const;

function maskApiKey(key: string | undefined): string | undefined {
  if (!key || key.length < 8) return key ? '***' : undefined;
  return key.slice(0, 4) + '...' + key.slice(-4);
}

// GET /api/config/llm — return full config (API key masked)
app.get('/llm', (c) => {
  const config = loadConfig();
  const llm = config?.dashboard?.llm;

  return c.json({
    dashboardPort: config?.dashboard?.port ?? 7890,
    provider: llm?.provider,
    model: llm?.model,
    apiKey: maskApiKey(llm?.apiKey),
    baseUrl: llm?.baseUrl,
  });
});

// PUT /api/config/llm — update dashboard port and/or LLM config
app.put('/llm', async (c) => {
  const body = await c.req.json<{
    dashboardPort?: number;
    provider?: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  }>();

  const config: ClaudeInsightConfig = loadConfig() ?? {
    sync: { claudeDir: '', excludeProjects: [] },
  };

  let changed = false;

  // Update dashboard port if provided
  if (body.dashboardPort !== undefined) {
    const port = body.dashboardPort;
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
      return c.json({ error: 'dashboardPort 必须是 1 到 65535 之间的整数' }, 400);
    }
    config.dashboard = { ...config.dashboard, port };
    changed = true;
  }

  // Update LLM config if any LLM field is provided
  const hasLLMField = body.provider !== undefined || body.model !== undefined ||
    body.apiKey !== undefined || body.baseUrl !== undefined;

  if (hasLLMField) {
    if (body.provider !== undefined && !VALID_PROVIDERS.includes(body.provider as typeof VALID_PROVIDERS[number])) {
      return c.json({ error: `provider 必须是以下之一：${VALID_PROVIDERS.join(', ')}` }, 400);
    }

    const existingLlm = config.dashboard?.llm ?? {} as Partial<LLMProviderConfig>;

    const updatedLlm: LLMProviderConfig = {
      provider: (body.provider as LLMProviderConfig['provider']) ?? existingLlm.provider ?? 'ollama',
      model: body.model ?? existingLlm.model ?? '',
      // Preserve existing API key if not provided in update
      ...(body.apiKey !== undefined
        ? { apiKey: body.apiKey || undefined }
        : existingLlm.apiKey !== undefined ? { apiKey: existingLlm.apiKey } : {}),
      ...(body.baseUrl !== undefined
        ? { baseUrl: body.baseUrl || undefined }
        : existingLlm.baseUrl !== undefined ? { baseUrl: existingLlm.baseUrl } : {}),
    };

    if (!updatedLlm.model) {
      return c.json({ error: '设置 LLM 配置时，model 为必填项' }, 400);
    }

    if (updatedLlm.provider === 'custom' && !updatedLlm.baseUrl) {
      return c.json({ error: '自定义提供商需要 baseUrl' }, 400);
    }

    config.dashboard = { ...config.dashboard, llm: updatedLlm };
    changed = true;
  }

  if (!changed) {
    return c.json({ ok: true });
  }

  saveConfig(config);
  return c.json({ ok: true });
});

// POST /api/config/llm/test — validate LLM credentials with a test call
app.post('/llm/test', async (c) => {
  // Allow testing with body config or existing saved config
  let testConfig: LLMProviderConfig | null = null;

  try {
    const body = await c.req.json<Partial<LLMProviderConfig>>();
    if (body.provider && body.model) {
      testConfig = {
        provider: body.provider,
        model: body.model,
        ...(body.apiKey ? { apiKey: body.apiKey } : {}),
        ...(body.baseUrl ? { baseUrl: body.baseUrl } : {}),
      };
    }
  } catch {
    // No body or invalid JSON — use existing config
  }

  if (!testConfig) {
    testConfig = loadLLMConfig();
  }

  if (!testConfig) {
    return c.json({
      success: false,
      error: '未找到 LLM 配置。运行 `code-insights config llm` 或在请求体中提供配置。',
    }, 400);
  }

  const result = await testLLMConfig(testConfig);
  return c.json(result, result.success ? 200 : 422);
});

// GET /api/config/llm/ollama-models — return locally available Ollama models
app.get('/llm/ollama-models', async (c) => {
  const baseUrl = c.req.query('baseUrl');
  const models = await discoverOllamaModels(baseUrl);
  return c.json({ models });
});

// GET /api/config/llm/llamacpp-models — return model(s) loaded in the running llama-server instance
app.get('/llm/llamacpp-models', async (c) => {
  const baseUrl = c.req.query('baseUrl');
  const models = await discoverLlamaCppModels(baseUrl);
  return c.json({ models });
});

export default app;
