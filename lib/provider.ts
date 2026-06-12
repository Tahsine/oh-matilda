import { getBgeM3Path } from './models';
import { prepareEmbeddingModel, createLocalProvider } from './providers/llama-provider';
import { createModel, getActiveProvider, getProviderInfo as getRegistryInfo } from './providers/registry';

let cachedEmbeddingModel: Awaited<ReturnType<typeof prepareEmbeddingModel>> | null = null;

export function getProviderInfo() {
  return getRegistryInfo();
}

export async function prepareEmbedding() {
  cachedEmbeddingModel = await prepareEmbeddingModel(getBgeM3Path());
  console.log('[provider] embedding model prepared');
}

export function getModel(modelId?: string) {
  const config = getActiveProvider();
  if (config.provider === 'llama-local') {
    return createLocalProvider().languageModel(config.activeModel);
  }
  return createModel(modelId);
}

export function getEmbeddingModel() {
  if (cachedEmbeddingModel) return cachedEmbeddingModel;
  return createLocalProvider().textEmbeddingModel(getBgeM3Path());
}
