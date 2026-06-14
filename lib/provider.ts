import { getBgeM3Path, getGemma4Path, getMmprojPath } from './models';
import { prepareEmbeddingModel, prepareLanguageModel, createLocalProvider } from './providers/llama-provider';
import { createModel, getActiveProvider, getProviderInfo as getRegistryInfo } from './providers/registry';
import i18n from './i18n';

let cachedEmbeddingModel: Awaited<ReturnType<typeof prepareEmbeddingModel>> | null = null;
let cachedLocalModel: ReturnType<ReturnType<typeof createLocalProvider>['languageModel']> | null = null;

export function getProviderInfo() {
  return getRegistryInfo();
}

export async function prepareEmbedding() {
  cachedEmbeddingModel = await prepareEmbeddingModel(getBgeM3Path());
  console.log('[provider] embedding model prepared');
}

export async function prepareLocalLLM() {
  const config = getActiveProvider();
  if (config.provider !== 'llama-local') {
    console.log('[provider] skipping local LLM prepare (provider:', config.provider, ')');
    return false;
  }
  console.log('[provider] preparing local LLM...');
  try {
    cachedLocalModel = await prepareLanguageModel(getGemma4Path(), getMmprojPath());
    console.log('[provider] local LLM prepared');
    return true;
  } catch (err) {
    console.error('[provider] local LLM prepare failed:', err);
    cachedLocalModel = null;
    return false;
  }
}

export async function unloadLocalLLM() {
  if (cachedLocalModel) {
    console.log('[provider] unloading local LLM...');
    await cachedLocalModel.unload();
    cachedLocalModel = null;
    console.log('[provider] local LLM unloaded');
  }
}

export async function reloadLocalLLM() {
  const config = getActiveProvider();
  if (config.provider !== 'llama-local') {
    console.log('[provider] skipping reload (provider:', config.provider, ')');
    return;
  }
  if (cachedLocalModel) {
    console.log('[provider] unloading current local LLM...');
    await cachedLocalModel.unload();
    cachedLocalModel = null;
  }
  console.log('[provider] reloading local LLM with new params...');
  cachedLocalModel = await prepareLanguageModel(getGemma4Path(), getMmprojPath());
  console.log('[provider] local LLM reloaded');
}

export function getModel(modelId?: string) {
  const config = getActiveProvider();
  if (config.provider === 'llama-local') {
    if (!cachedLocalModel)     throw new Error(i18n.t('errors.localModelNotReady'));
    return cachedLocalModel;
  }
  return createModel(modelId);
}

export function getEmbeddingModel() {
  if (cachedEmbeddingModel) return cachedEmbeddingModel;
  return createLocalProvider().textEmbeddingModel(getBgeM3Path());
}
