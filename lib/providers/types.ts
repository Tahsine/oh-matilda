import type { LanguageModelV1 } from 'ai';

export type ProviderName = 'ollama-cloud' | 'ollama-hosted' | 'openai' | 'anthropic' | 'llama-local' | 'groq';

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
  createModel: (config: ProviderConfig) => LanguageModelV1;
  fetchModels?: (config: ProviderConfig) => Promise<string[]>;
}
