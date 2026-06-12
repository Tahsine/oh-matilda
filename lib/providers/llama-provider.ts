let llamaModule: typeof import('@react-native-ai/llama') | null = null;

try {
  llamaModule = require('@react-native-ai/llama');
} catch {
  // Native module not available (Expo Go or missing dev build)
}

export async function prepareEmbeddingModel(path: string) {
  const { llama } = llamaModule!;
  const model = llama.textEmbeddingModel(path);
  await (model as any).prepare();
  return model;
}

export function createLocalProvider() {
  if (!llamaModule) {
    throw new Error(
      '@react-native-ai/llama non disponible. Utilise un dev build avec le module natif.',
    );
  }

  const { llama } = llamaModule;

  return {
    languageModel: (modelId: string) => llama.languageModel(modelId),
    textEmbeddingModel: (modelId: string) => llama.textEmbeddingModel(modelId),
  };
}
