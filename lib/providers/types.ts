import type { LanguageModel } from 'ai';

export type ProviderName = 'ollama-cloud' | 'ollama-hosted' | 'self-hosted' | 'llama-local';

export type ProviderConfig = {
  provider: ProviderName;
  apiKey: string;
  baseUrl: string;
  activeModel: string;
};

export interface ProviderAdapter {
  name: ProviderName;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  createModel: (config: ProviderConfig) => LanguageModel;
  fetchModels?: (config: ProviderConfig) => Promise<string[]>;
}
