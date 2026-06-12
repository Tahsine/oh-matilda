import { createOllama } from 'ai-sdk-ollama/browser';
import { fetch as expoFetch } from 'expo/fetch';
import { getBgeM3Path } from './models';
import { createLocalProvider, prepareEmbeddingModel } from './providers/llama-provider';

const USE_LOCAL = process.env.EXPO_PUBLIC_USE_LOCAL_LLM === 'true';
const API_KEY = process.env.EXPO_PUBLIC_OLLAMA_API_KEY ?? '';
const CLOUD_MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL ?? 'minimax-m3:cloud';

let cloudProvider: ReturnType<typeof createOllama> | null = null;
let cachedEmbeddingModel: Awaited<ReturnType<typeof prepareEmbeddingModel>> | null = null;

function getCloudProvider() {
  if (!cloudProvider) {
    cloudProvider = createOllama({
      baseURL: 'https://ollama.com',
      apiKey: API_KEY || undefined,
      fetch: expoFetch as unknown as typeof globalThis.fetch,
    });
  }
  return cloudProvider;
}

export async function prepareEmbedding() {
  cachedEmbeddingModel = await prepareEmbeddingModel(getBgeM3Path());
  console.log('[provider] embedding model prepared');
}

export function getModel(modelId?: string) {
  if (USE_LOCAL) {
    return createLocalProvider().languageModel(modelId ?? 'gemma-4-4e4b-it-q4_k_xl');
  }
  const id = modelId ?? CLOUD_MODEL;
  return getCloudProvider()(id);
}

export function getEmbeddingModel() {
  if (cachedEmbeddingModel) return cachedEmbeddingModel;
  return createLocalProvider().textEmbeddingModel(getBgeM3Path());
}
