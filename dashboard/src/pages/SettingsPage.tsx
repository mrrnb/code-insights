import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useLlmConfig, useSaveLlmConfig } from '@/hooks/useConfig';
import { fetchOllamaModels, testLlmConfig } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  CheckCircle,
  XCircle,
  Cpu,
  Loader2,
  ChevronDown,
  ChevronRight,
  Check,
  Minus,
} from 'lucide-react';

type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

interface ProviderInfo {
  id: LLMProvider;
  name: string;
  requiresApiKey: boolean;
  apiKeyLink?: string;
  models: Array<{ id: string; name: string; description?: string }>;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    apiKeyLink: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', description: '最佳' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: '快且便宜' },
      { id: 'gpt-4o', name: 'GPT-4o', description: '备用' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    apiKeyLink: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '能力最强' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '综合最均衡' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '快且便宜' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    requiresApiKey: true,
    apiKeyLink: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '快速' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '更强' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama（本地）',
    requiresApiKey: false,
    models: [
      { id: 'llama3.3', name: 'Llama 3.3' },
      { id: 'qwen3:14b', name: 'Qwen3 14B' },
      { id: 'mistral', name: 'Mistral' },
    ],
  },
  {
    id: 'custom',
    name: '自定义 OpenAI 兼容接口',
    requiresApiKey: true,
    models: [
      { id: 'custom-model', name: '自定义模型', description: '支持任意兼容 Chat Completions 的接口' },
    ],
  },
];

export default function SettingsPage() {
  const { data: llmConfig, isLoading: configLoading } = useLlmConfig();
  const saveMutation = useSaveLlmConfig();

  const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai');
  const [llmModel, setLlmModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestError, setLlmTestError] = useState<string | null>(null);
  const [ollamaDiscoveredModels, setOllamaDiscoveredModels] = useState<string[]>([]);
  const [ollamaCorsOpen, setOllamaCorsOpen] = useState(false);

  // Populate form from loaded config
  useEffect(() => {
    if (!llmConfig) return;
    if (llmConfig.provider) {
      setLlmProvider(llmConfig.provider as LLMProvider);
      setLlmConfigured(true);
    }
    if (llmConfig.model) {
      // If saved model doesn't match any preset, populate the custom input instead
      const providerInfo = PROVIDERS.find((p) => p.id === (llmConfig.provider ?? llmProvider));
      const isPreset = providerInfo?.models.some((m) => m.id === llmConfig.model);
      if (isPreset) {
        setLlmModel(llmConfig.model);
        setCustomModel('');
      } else {
        setCustomModel(llmConfig.model);
        setLlmModel(providerInfo?.models[0]?.id ?? '');
      }
    }
    // apiKey is masked by server — leave blank for re-entry
    if (llmConfig.baseUrl) setLlmBaseUrl(llmConfig.baseUrl);
  }, [llmConfig]);

  // Default model when provider changes
  useEffect(() => {
    const providerInfo = PROVIDERS.find((p) => p.id === llmProvider);
    if (providerInfo?.models[0] && !llmModel) {
      setLlmModel(providerInfo.models[0].id);
    }
  }, [llmProvider, llmModel]);

  // Discover Ollama models
  useEffect(() => {
    if (llmProvider !== 'ollama') return;
    fetchOllamaModels(llmBaseUrl || undefined)
      .then((r) => setOllamaDiscoveredModels(r.models.map((m) => m.name)))
      .catch(() => {});
  }, [llmProvider, llmBaseUrl]);

  const handleProviderChange = (provider: LLMProvider) => {
    setLlmProvider(provider);
    setLlmConfigured(false);
    setLlmTestError(null);
    setLlmApiKey('');
    setCustomModel('');
    const providerInfo = PROVIDERS.find((p) => p.id === provider);
    setLlmModel(providerInfo?.models[0]?.id ?? '');
  };

  const handleSaveLLMConfig = async () => {
    const providerInfo = PROVIDERS.find((p) => p.id === llmProvider);
    if (!providerInfo) return;

    // Custom model input overrides the dropdown selection for cloud providers
    const effectiveModel = customModel.trim() || llmModel;

    if (providerInfo.requiresApiKey && !llmApiKey && !llmConfigured) {
      setLlmTestError('需要填写 API Key');
      return;
    }
    if (llmProvider === 'custom' && !llmBaseUrl.trim()) {
      setLlmTestError('自定义接口必须填写 Base URL');
      return;
    }
    if (!effectiveModel) {
      setLlmTestError('请填写模型 ID');
      return;
    }

    setLlmTesting(true);
    setLlmTestError(null);

    try {
      const testResult = await testLlmConfig({
        provider: llmProvider,
        model: effectiveModel,
        apiKey: llmApiKey || undefined,
        baseUrl: llmBaseUrl || undefined,
      });

      if (testResult.success) {
        await saveMutation.mutateAsync({
          provider: llmProvider,
          model: effectiveModel,
          apiKey: llmApiKey || undefined,
          baseUrl: llmBaseUrl || undefined,
        });
        setLlmConfigured(true);
        setLlmTestError(null);
        toast.success('AI 分析提供商配置成功');
      } else {
        setLlmTestError(testResult.error || '连接测试失败');
      }
    } catch (err) {
      setLlmTestError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setLlmTesting(false);
    }
  };

  const handleClearLLMConfig = async () => {
    try {
      await saveMutation.mutateAsync({ provider: undefined, model: undefined, apiKey: undefined });
      setLlmConfigured(false);
      setLlmApiKey('');
      setCustomModel('');
      setLlmTestError(null);
      toast.success('已清空 AI 提供商配置');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '清空配置失败';
      setLlmTestError(msg);
      toast.error(msg);
    }
  };

  const progressItems = [
    { label: 'AI 提供商', done: llmConfigured, required: true },
  ];
  const requiredDone = progressItems.filter((p) => p.required && p.done).length;
  const requiredTotal = progressItems.filter((p) => p.required).length;

  if (configLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">设置</h1>
          <p className="text-muted-foreground">配置 Code Insights 控制台</p>
        </div>
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground">配置 Code Insights 控制台</p>
      </div>

      {/* Setup progress strip */}
      <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium shrink-0">
          配置进度：已完成 {requiredDone}/{requiredTotal} 项必填配置
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          {progressItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs">
              {item.done ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* LLM Provider Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              <CardTitle className="text-base">AI 分析提供商</CardTitle>
            </div>
            {llmConfigured ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                已连接
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                <XCircle className="mr-1 h-3 w-3" />
                未配置
              </Badge>
            )}
          </div>
          <CardDescription>
            配置一个 LLM 提供商，用于分析会话并生成洞察
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="text-sm font-medium">提供商</label>
            <Select
              value={llmProvider}
              onValueChange={(v) => handleProviderChange(v as LLMProvider)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择提供商" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium">模型</label>
            {llmProvider === 'ollama' ? (
              <div className="mt-1 space-y-2">
                <Input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="输入任意模型名，例如 llama3.3"
                />
                {(() => {
                  const hardcoded =
                    PROVIDERS.find((p) => p.id === 'ollama')?.models.map((m) => m.id) ?? [];
                  const suggestions = [...new Set([...hardcoded, ...ollamaDiscoveredModels])];
                  return suggestions.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">建议：</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setLlmModel(name)}
                            className="text-xs px-2 py-0.5 rounded-md border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="mt-1 space-y-2">
                <Select value={llmModel} onValueChange={setLlmModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.find((p) => p.id === llmProvider)?.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{model.name}</span>
                          {model.description && (
                            <span className="text-xs text-muted-foreground">
                              {model.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <label className="text-xs text-muted-foreground">或直接输入自定义模型 ID</label>
                  <Input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="例如 gpt-4.1-nano、claude-opus-4-6、deepseek-chat"
                    className="mt-1"
                  />
                  {customModel.trim() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      将优先使用自定义模型 <span className="font-mono">{customModel.trim()}</span>，而不是下拉框中的模型。
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* API Key (if required) */}
          {PROVIDERS.find((p) => p.id === llmProvider)?.requiresApiKey && (
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                value={llmApiKey}
                onChange={(e) => {
                  setLlmApiKey(e.target.value);
                  setLlmConfigured(false);
                }}
                placeholder={
                  llmConfigured
                    ? '留空则保留当前 Key'
                    : llmProvider === 'openai'
                      ? 'sk-...'
                      : llmProvider === 'anthropic'
                        ? 'sk-ant-...'
                        : llmProvider === 'gemini'
                          ? 'AIza...'
                          : '填入你的自定义 Key'
                }
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                获取 API Key：{' '}
                <a
                  href={PROVIDERS.find((p) => p.id === llmProvider)?.apiKeyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {PROVIDERS.find((p) => p.id === llmProvider)?.name}
                </a>
              </p>
            </div>
          )}

          {/* Ollama: Base URL + collapsible CORS instructions */}
          {llmProvider === 'ollama' && (
            <>
              <div>
                <label className="text-sm font-medium">Base URL（可选）</label>
                <Input
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  留空则使用默认地址（localhost:11434）
                </p>
              </div>

              {/* Collapsible CORS instructions */}
              <Collapsible open={ollamaCorsOpen} onOpenChange={setOllamaCorsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                  >
                    {ollamaCorsOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Ollama 连接说明
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Ollama 运行在本机，控制台通过 localhost:7890 上的 Hono 服务转发请求，通常不需要额外配置 CORS。
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      测试前请确认 Ollama 已启动：{' '}
                      <code className="bg-amber-100 dark:bg-amber-950/50 px-0.5 rounded">
                        ollama serve
                      </code>
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}

          {llmProvider === 'custom' && (
            <div>
              <label className="text-sm font-medium">Base URL</label>
              <Input
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                填写 OpenAI Chat Completions 兼容接口地址，例如 OpenAI、OpenRouter、DeepSeek、硅基流动或自建网关。
              </p>
            </div>
          )}

          {/* Error message */}
          {llmTestError && <p className="text-sm text-red-500">{llmTestError}</p>}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSaveLLMConfig} disabled={llmTesting || saveMutation.isPending}>
              {llmTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  测试中...
                </>
              ) : llmConfigured ? (
                '更新配置'
              ) : (
                '保存并测试'
              )}
            </Button>
            {llmConfigured && (
              <Button
                variant="outline"
                onClick={handleClearLLMConfig}
                disabled={saveMutation.isPending}
              >
                清空
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CLI Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CLI 安装与初始化</CardTitle>
          <CardDescription>
            安装并配置 CLI，用来同步您的 AI 编程会话
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 font-mono text-sm">
            <p className="text-muted-foreground"># 安装 CLI</p>
            <p>npm install -g @code-insights/cli</p>
            <p className="mt-2 text-muted-foreground"># 初始化</p>
            <p>code-insights init</p>
            <p className="mt-2 text-muted-foreground"># 同步会话</p>
            <p>code-insights sync</p>
            <p className="mt-2 text-muted-foreground"># 打开控制台</p>
            <p>code-insights dashboard</p>
          </div>
          <p className="text-sm text-muted-foreground">
            CLI 会把 Claude Code、Cursor、Codex CLI 和 Copilot CLI 的会话解析后写入本地 SQLite 数据库。所有数据都保留在您的机器上。
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-2 pb-4">
        Code Insights &mdash;{' '}
        <a
          href="https://github.com/mrrnb/code-insights"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          在 GitHub 查看
        </a>
      </div>
    </div>
  );
}
