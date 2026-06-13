import { getGemma4Path, getMmprojPath } from '../models';
import { createLocalProvider } from './llama-provider';
import type { ProviderAdapter } from './types';

export const llamaLocalAdapter: ProviderAdapter = {
  name: 'llama-local',
  label: 'llama.cpp (local)',
  defaultModel: 'gemma-4-E2B-it-qat-UD-Q2_K_XL',
  defaultBaseUrl: '',

  createModel() {
    const projectorPath = getMmprojPath();
    const provider = createLocalProvider(projectorPath);
    return provider.languageModel(getGemma4Path());
  },

  async fetchModels() {
    return ['gemma-4-E2B-it-qat-UD-Q2_K_XL'];
  },
};
