import { getSetting } from '../settings';
import i18n from '../i18n';

let llamaModule: typeof import('@react-native-ai/llama') | null = null;

try {
  llamaModule = require('@react-native-ai/llama');
} catch {
  // Native module not available (Expo Go or missing dev build)
}

function readContextParams() {
  return {
    n_ctx: parseInt(getSetting('llm_n_ctx'), 10) || 4096,
    n_gpu_layers: parseInt(getSetting('llm_n_gpu_layers'), 10) || 99,
    n_batch: parseInt(getSetting('llm_n_batch'), 10) || 512,
    n_threads: parseInt(getSetting('llm_n_threads'), 10) || 4,
    flash_attn_type: getSetting('llm_flash_attn') === 'true' ? ('auto' as const) : ('off' as const),
  };
}

export async function prepareEmbeddingModel(path: string) {
  const { llama } = llamaModule!;
  const model = llama.textEmbeddingModel(path);
  await (model as any).prepare();
  return model;
}

export async function prepareLanguageModel(path: string, projectorPath?: string) {
  const { llama } = llamaModule!;
  const contextParams = readContextParams();
  const opts = { projectorPath, contextParams };
  const model = llama.languageModel(path, opts);
  await (model as any).prepare();
  console.log('[llama-provider] language model prepared with params:', contextParams);
  return model;
}

export function createLocalProvider(projectorPath?: string) {
  if (!llamaModule) {
    throw new Error(
      i18n.t('errors.nativeModuleNotAvailable'),
    );
  }

  const { llama } = llamaModule;

  return {
    languageModel: (modelId: string) => {
      const contextParams = readContextParams();
      const opts = { projectorPath, contextParams };
      return llama.languageModel(modelId, opts);
    },
    textEmbeddingModel: (modelId: string) => llama.textEmbeddingModel(modelId),
  };
}
