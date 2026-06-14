import type { LanguageModel } from 'ai';
import i18n from '../i18n';
import { getSetting, setSetting } from '../settings';
import type { ProviderConfig, ProviderName, ProviderAdapter } from './types';
import { ollamaCloudAdapter } from './ollama-cloud';
import { llamaLocalAdapter } from './llama-local-adapter';

const adapters: Record<string, ProviderAdapter> = {
  'ollama-cloud': ollamaCloudAdapter,
  'ollama-hosted': ollamaCloudAdapter,
  'llama-local': llamaLocalAdapter,
};

const ENV_FALLBACKS: Partial<Record<string, string | undefined>> = {
  'ollama-cloud': process.env.EXPO_PUBLIC_OLLAMA_API_KEY,
  'ollama-hosted': process.env.EXPO_PUBLIC_OLLAMA_API_KEY,
};

function loadConfig(): ProviderConfig {
  const provider = (getSetting('provider') as ProviderName) || 'ollama-cloud';
  const adapter = getAdapter(provider);

  let baseUrl: string;
  if (provider === 'ollama-cloud') {
    baseUrl = 'https://ollama.com';
  } else if (provider === 'ollama-hosted') {
    baseUrl = getSetting('server_url') || 'http://localhost:8080';
  } else {
    baseUrl = getSetting('server_url') || adapter.defaultBaseUrl || '';
  }

  const config: ProviderConfig = {
    provider,
    apiKey: getSetting('api_key') || ENV_FALLBACKS[provider] || '',
    baseUrl,
    activeModel: getSetting('active_model') || adapter.defaultModel,
  };
  console.log('[registry] loadConfig:', JSON.stringify({ ...config, apiKey: config.apiKey ? '***' : '' }));
  return config;
}

export function saveProviderConfig(overrides: Partial<ProviderConfig> & { provider?: string }): void {
  if (overrides.provider !== undefined) setSetting('provider', overrides.provider);
  if (overrides.apiKey !== undefined) setSetting('api_key', overrides.apiKey);
  if (overrides.baseUrl !== undefined) setSetting('server_url', overrides.baseUrl);
  if (overrides.activeModel !== undefined) setSetting('active_model', overrides.activeModel);
}

export function getActiveProvider(): ProviderConfig {
  return loadConfig();
}

export function createModel(modelId?: string): LanguageModel {
  const config = loadConfig();
  const adapter = adapters[config.provider] || ollamaCloudAdapter;
  const effective = modelId || config.activeModel || adapter.defaultModel;
  console.log('[registry] createModel:', effective, 'via', adapter.name);
  return adapter.createModel({ ...config, activeModel: effective });
}

export async function fetchModels(provider?: string): Promise<string[]> {
  const config = loadConfig();
  const name = provider || config.provider;
  const adapter = adapters[name] || ollamaCloudAdapter;
  if (!adapter.fetchModels) return [config.activeModel || adapter.defaultModel];
  return adapter.fetchModels(config);
}

export function getProviderInfo() {
  const config = loadConfig();
  const adapter = adapters[config.provider] || ollamaCloudAdapter;
  const label = providerLabel(config.provider);
  return {
    provider: label,
    model: config.activeModel || adapter.defaultModel,
    serverUrl: config.baseUrl,
  };
}

const LABEL_KEYS: Record<string, string> = {
  'ollama-cloud': 'onboarding.provider.ollamaCloud',
  'ollama-hosted': 'onboarding.provider.selfHosted',
  'llama-local': 'onboarding.provider.onDevice',
};

export function providerLabel(name: ProviderName): string {
  const key = LABEL_KEYS[name];
  return key ? i18n.t(key) : (adapters[name]?.label || 'Ollama Cloud');
}

export function getAdapter(name: string): ProviderAdapter {
  return adapters[name] || ollamaCloudAdapter;
}

export function getAvailableProviders(): { name: string; label: string; available: boolean }[] {
  return [
    { name: 'ollama-cloud', label: i18n.t('onboarding.provider.ollamaCloud'), available: true },
    { name: 'ollama-hosted', label: i18n.t('onboarding.provider.selfHosted'), available: true },
    { name: 'llama-local', label: i18n.t('onboarding.provider.onDevice'), available: true },
  ];
}
