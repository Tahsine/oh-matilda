import { tool } from 'ai';
import { z } from 'zod';
import { generateEmbedding } from '../embeddings';
import { searchSimilar } from '../vector-store';
import { pushError } from '../error-handler';
import { logger } from '../logger';
import i18n from '../i18n';

export const searchDocuments = tool({
  description: `Semantic search in the user's imported documents (PDF, Word).
Use this tool when the user asks a question about their document content.
You can call it multiple times with different queries if the first attempt doesn't return relevant results.
Results include a relevance score (0-1). Below 0.5, results are likely off-topic.`,
  inputSchema: z.object({
    query: z.string().describe('The semantic search query. Be specific for better results.'),
    maxResults: z.number().default(5).describe('Maximum number of results'),
  }),
  execute: async ({ query, maxResults }) => {
    console.log('[search] execute:', { query, maxResults });
    logger.search('execute', { query, maxResults });

    let embedding: number[];
    try {
      embedding = await generateEmbedding(query);
      console.log('[search] embedding OK:', { dims: embedding.length });
      logger.search('embedding OK', { dims: embedding.length });
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unknown error';
      logger.search('embedding FAILED', reason);
      pushError({ type: 'search', message: i18n.t('errors.searchFailed', { reason }) });
      return {
        results: [],
        total: 0,
        query,
        searchType: 'failed',
        reason: `Failed to generate embedding: ${reason}`,
      };
    }

    const results = searchSimilar(embedding, maxResults, 0.2);
    console.log('[search] results:', { count: results.length, topScore: results[0]?.score ?? 0 });
    logger.search('results', { count: results.length, topScore: results[0]?.score ?? 0 });

    if (results.length === 0) {
      return {
        results: [],
        total: 0,
        query,
        searchType: 'vector',
        reason: 'No relevant results found in indexed documents. Try a more specific query or check that your imported documents contain this information.',
      };
    }

    return {
      results: results.map(r => ({
        documentId: r.documentId,
        documentName: r.documentName,
        content: r.content,
        score: r.score,
      })),
      total: results.length,
      query,
      searchType: 'vector',
    };
  },
});
