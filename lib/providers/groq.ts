import { createOpenAI } from '@ai-sdk/openai';
import { fetch as expoFetch } from 'expo/fetch';
import type { ProviderConfig, ProviderAdapter } from './types';

let cachedGroq: ReturnType<typeof createOpenAI> | null = null;
let cachedConfigKey = '';

export const groqAdapter: ProviderAdapter = {
  name: 'groq',
  label: 'Groq',
  defaultModel: 'gpt-oss-120b',
  defaultBaseUrl: 'https://api.groq.com/openai/v1',

  createModel(config: ProviderConfig) {
    const key = `${config.baseUrl}|${config.apiKey}`;
    if (!cachedGroq || cachedConfigKey !== key) {
      console.log('[groq] createModel baseURL:', config.baseUrl, 'model:', config.activeModel, 'apiKey:', config.apiKey ? '***' : 'none');
      cachedGroq = createOpenAI({
        baseURL: config.baseUrl || 'https://api.groq.com/openai/v1',
        apiKey: config.apiKey || '',
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      });
      cachedConfigKey = key;
    }
    const model = cachedGroq(config.activeModel || 'gpt-oss-120b');
    return model as any;
  },

  async fetchModels(config: ProviderConfig): Promise<string[]> {
    try {
      const res = await expoFetch(`${config.baseUrl || 'https://api.groq.com/openai/v1'}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const data = await res.json() as { data?: { id: string }[] };
      return data.data?.map(m => m.id) ?? [config.activeModel || 'gpt-oss-120b'];
    } catch {
      return [config.activeModel || 'gpt-oss-120b'];
    }
  },
};
