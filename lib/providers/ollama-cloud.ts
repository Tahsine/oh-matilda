import { createOllama } from 'ai-sdk-ollama/browser';
import { fetch as expoFetch } from 'expo/fetch';
import type { ProviderConfig, ProviderAdapter } from './types';

let cachedOllama: ReturnType<typeof createOllama> | null = null;
let cachedConfigKey = '';

export const ollamaCloudAdapter: ProviderAdapter = {
  name: 'ollama-cloud',
  label: 'Ollama Cloud',
  defaultModel: 'minimax-m3:cloud',
  defaultBaseUrl: 'https://ollama.com',

  createModel(config: ProviderConfig) {
    const key = `${config.baseUrl}|${config.apiKey}`;
    if (!cachedOllama || cachedConfigKey !== key) {
      console.log('[ollama-cloud] createModel baseURL:', config.baseUrl, 'model:', config.activeModel, 'apiKey:', config.apiKey ? '***' : 'none');
      cachedOllama = createOllama({
        baseURL: config.baseUrl || 'https://ollama.com',
        apiKey: config.apiKey || undefined,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
      });
      cachedConfigKey = key;
    }
    const model = cachedOllama(config.activeModel || 'minimax-m3:cloud');
    return model as any;
  },

  async fetchModels(config: ProviderConfig): Promise<string[]> {
    try {
      const res = await expoFetch(`${config.baseUrl || 'https://ollama.com'}/api/tags`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined,
      });
      const data = await res.json() as { models?: { name: string }[] };
      return data.models?.map(m => m.name) ?? [config.activeModel || 'minimax-m3:cloud'];
    } catch {
      return [config.activeModel || 'minimax-m3:cloud'];
    }
  },
};
