import { getEmbeddingsWithContent, insertChunkEmbedding } from './db';
import { logger } from './logger';
import type { Chunk } from './types';

export type SearchResult = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
};

export function storeEmbeddings(
  chunks: Chunk[],
  embeddings: number[][],
): void {
  logger.embed('storeEmbeddings', { count: chunks.length });
  for (let i = 0; i < chunks.length; i++) {
    insertChunkEmbedding(chunks[i].id, embeddings[i], chunks[i].documentId);
  }
}

export function searchSimilar(
  queryEmbedding: number[],
  limit = 5,
  minScore = 0.3,
): SearchResult[] {
  const rows = getEmbeddingsWithContent();
  console.log('[vector] searchSimilar:', { totalEmbeddings: rows.length, limit, minScore });
  logger.search('searchSimilar', { totalEmbeddings: rows.length, limit, minScore });

  if (rows.length === 0) {
    console.log('[vector] no embeddings in DB');
    logger.search('searchSimilar: no embeddings in DB');
    return [];
  }

  const scored: SearchResult[] = [];

  for (const row of rows) {
    const emb: number[] = JSON.parse(row.embedding);
    const score = cosineSimilarity(queryEmbedding, emb);
    if (score >= minScore) {
      scored.push({
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentName: row.documentName,
        content: row.content,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  logger.search('searchSimilar: done', { candidates: scored.length, returned: top.length });

  return top;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
