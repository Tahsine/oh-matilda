import { embed, embedMany } from 'ai';
import { getEmbeddingModel } from './provider';
import { logger } from './logger';

let queue = Promise.resolve();

export async function generateEmbedding(text: string): Promise<number[]> {
  const task = queue.then(() => {
    const t0 = performance.now();
    const model = getEmbeddingModel();
    return embed({ model, value: text }).then(({ embedding }) => {
      const ms = (performance.now() - t0).toFixed(0);
      console.log('[embed] generateEmbedding:', { chars: text.length, dims: embedding.length, ms });
      logger.embed('generateEmbedding', { chars: text.length, dims: embedding.length, ms: `${ms}ms` });
      return embedding;
    });
  });
  queue = task.catch(() => {});
  return task;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const task = queue.then(() => {
    const t0 = performance.now();
    const model = getEmbeddingModel();
    return embedMany({ model, values: texts }).then(({ embeddings }) => {
      const ms = (performance.now() - t0).toFixed(0);
      console.log('[embed] generateEmbeddings:', { count: texts.length, dims: embeddings[0]?.length, ms });
      logger.embed('generateEmbeddings', { count: texts.length, dims: embeddings[0]?.length, ms: `${ms}ms` });
      return embeddings;
    });
  });
  queue = task.catch(() => {});
  return task;
}
