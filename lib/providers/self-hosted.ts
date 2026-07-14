import { createOpenAI } from '@ai-sdk/openai';
import { fetch as expoFetch } from 'expo/fetch';
import type { ProviderConfig, ProviderAdapter } from './types';

let cachedOpenAI: ReturnType<typeof createOpenAI> | null = null;
let cachedConfigKey = '';

export const selfHostedAdapter: ProviderAdapter = {
  name: 'self-hosted',
  label: 'Self-hosted',
  defaultModel: 'gemma-4-E2B-it-qat-UD-Q2_K_XL',
  defaultBaseUrl: 'http://192.168.1.100:11434',

  createModel(config: ProviderConfig) {
    const key = `${config.baseUrl}|${config.apiKey}`;
    if (!cachedOpenAI || cachedConfigKey !== key) {
      cachedOpenAI = createOpenAI({
        baseURL: `${config.baseUrl || 'http://192.168.1.100:11434'}/v1`,
        apiKey: config.apiKey || 'ollama',
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      });
      cachedConfigKey = key;
    }
    const model = cachedOpenAI(config.activeModel || 'gemma-4-E2B-it-qat-UD-Q2_K_XL');
    return model as any;
  },

  async fetchModels(config: ProviderConfig): Promise<string[]> {
    try {
      const baseUrl = config.baseUrl || 'http://192.168.1.100:11434';
      const res = await expoFetch(`${baseUrl}/api/tags`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
      });
      const data = await res.json() as { models?: { name: string }[] };
      return data.models?.map(m => m.name) ?? [config.activeModel || 'gemma-4-E2B-it-qat-UD-Q2_K_XL'];
    } catch {
      return [config.activeModel || 'gemma-4-E2B-it-qat-UD-Q2_K_XL'];
    }
  },
};
