import { embed, embedMany } from 'ai';
import { getEmbeddingModel } from './provider';
import { logger } from './logger';

export async function generateEmbedding(text: string): Promise<number[]> {
  const t0 = performance.now();
  const model = getEmbeddingModel();
  const { embedding } = await embed({ model, value: text });
  const ms = (performance.now() - t0).toFixed(0);
  logger.embed('generateEmbedding', { chars: text.length, dims: embedding.length, ms: `${ms}ms` });
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const t0 = performance.now();
  const model = getEmbeddingModel();
  const { embeddings } = await embedMany({ model, values: texts });
  const ms = (performance.now() - t0).toFixed(0);
  logger.embed('generateEmbeddings', { count: texts.length, dims: embeddings[0]?.length, ms: `${ms}ms` });
  return embeddings;
}
