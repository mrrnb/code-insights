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
import { useI18n } from '@/lib/i18n';

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
  const { t, language } = useI18n();
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
      setLlmTestError(t('settings.apiKeyRequired'));
      return;
    }
    if (llmProvider === 'custom' && !llmBaseUrl.trim()) {
      setLlmTestError(t('settings.baseUrlRequired'));
      return;
    }
    if (!effectiveModel) {
      setLlmTestError(t('settings.modelRequired'));
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
        toast.success(t('settings.apiSuccess'));
      } else {
        setLlmTestError(testResult.error || t('settings.connectFail'));
      }
    } catch (err) {
      setLlmTestError(err instanceof Error ? err.message : t('settings.saveFail'));
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
      toast.success(t('settings.clearSuccess'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('settings.clearFail');
      setLlmTestError(msg);
      toast.error(msg);
    }
  };

  const progressItems = [
    { label: t('settings.provider'), done: llmConfigured, required: true },
  ];
  const requiredDone = progressItems.filter((p) => p.required && p.done).length;
  const requiredTotal = progressItems.filter((p) => p.required).length;

  if (configLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.desc')}</p>
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
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.desc')}</p>
      </div>

      {/* Setup progress strip */}
      <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-sm font-medium shrink-0">
          {t('settings.progress', { done: requiredDone, total: requiredTotal })}
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
              <CardTitle className="text-base">{t('settings.providerSection')}</CardTitle>
            </div>
            {llmConfigured ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t('settings.connected')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                <XCircle className="mr-1 h-3 w-3" />
                {t('settings.notConfigured')}
              </Badge>
            )}
          </div>
          <CardDescription>
            {t('settings.providerDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="text-sm font-medium">{t('settings.provider')}</label>
            <Select
              value={llmProvider}
              onValueChange={(v) => handleProviderChange(v as LLMProvider)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t('settings.selectProvider')} />
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
            <label className="text-sm font-medium">{t('settings.model')}</label>
            {llmProvider === 'ollama' ? (
              <div className="mt-1 space-y-2">
                <Input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder={t('settings.modelAny')}
                />
                {(() => {
                  const hardcoded =
                    PROVIDERS.find((p) => p.id === 'ollama')?.models.map((m) => m.id) ?? [];
                  const suggestions = [...new Set([...hardcoded, ...ollamaDiscoveredModels])];
                  return suggestions.length > 0 ? (
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">{t('settings.suggestions')}</p>
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
                    <SelectValue placeholder={t('settings.selectModel')} />
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
                  <label className="text-xs text-muted-foreground">{t('settings.customModelLabel')}</label>
                  <Input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder={t('settings.customModelPlaceholder')}
                    className="mt-1"
                  />
                  {customModel.trim() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settings.customModelHelp', { model: customModel.trim() })}
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
                    ? t('settings.keepKey')
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
                {t('settings.getApiKey')}{' '}
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
                <label className="text-sm font-medium">{t('settings.baseUrlOptional')}</label>
                <Input
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('settings.baseUrlOptionalHelp')}
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
                    {t('settings.ollamaNotes')}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {t('settings.ollamaDesc')}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {t('settings.ollamaRun')}{' '}
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
                {t('settings.customBaseUrlHelp')}
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
                  {t('settings.testing')}
                </>
              ) : llmConfigured ? (
                t('settings.update')
              ) : (
                t('settings.saveAndTest')
              )}
            </Button>
            {llmConfigured && (
              <Button
                variant="outline"
                onClick={handleClearLLMConfig}
                disabled={saveMutation.isPending}
              >
                {t('settings.clear')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CLI Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.cliTitle')}</CardTitle>
          <CardDescription>
            {t('settings.cliDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 font-mono text-sm">
            <p className="text-muted-foreground">{t('settings.cliInstall')}</p>
            <p>npm install -g @code-insights/cli</p>
            <p className="mt-2 text-muted-foreground">{t('settings.cliInit')}</p>
            <p>code-insights init</p>
            <p className="mt-2 text-muted-foreground">{t('settings.cliSync')}</p>
            <p>code-insights sync</p>
            <p className="mt-2 text-muted-foreground">{t('settings.cliOpen')}</p>
            <p>code-insights dashboard</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.cliHelp')}
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
          {t('settings.viewGithub')}
        </a>
      </div>
    </div>
  );
}
