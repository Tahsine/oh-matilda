import { createOllama } from 'ai-sdk-ollama/browser';
import { fetch as expoFetch } from 'expo/fetch';

const API_KEY = process.env.EXPO_PUBLIC_OLLAMA_API_KEY ?? '';

const ollamaProvider = createOllama({
  baseURL: 'https://ollama.com',
  apiKey: API_KEY || undefined,
  fetch: expoFetch as unknown as typeof globalThis.fetch,
});

export function getModel(modelId = 'minimax-m3:cloud') {
  return ollamaProvider(modelId);
}
