import { tool } from 'ai';
import { z } from 'zod';
import { generateEmbedding } from '../embeddings';
import { searchSimilar } from '../vector-store';
import { logger } from '../logger';

export const searchDocuments = tool({
  description: `Recherche sémantique dans les documents importés par l'utilisateur (PDF, Word).
Utilise cette outil quand l'utilisateur pose une question sur le contenu de ses documents.
Tu peux l'appeler plusieurs fois avec des requêtes différentes si la première tentative ne donne pas de résultats pertinents.
Les résultats incluent un score de pertinence (0-1). En dessous de 0.5, les résultats sont probablement hors-sujet.`,
  inputSchema: z.object({
    query: z.string().describe('La requête de recherche sémantique. Sois précis pour de meilleurs résultats.'),
    maxResults: z.number().default(5).describe('Nombre maximum de résultats'),
  }),
  execute: async ({ query, maxResults }) => {
    logger.search('execute', { query, maxResults });

    let embedding: number[];
    try {
      embedding = await generateEmbedding(query);
      logger.search('embedding OK', { dims: embedding.length });
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Erreur inconnue';
      logger.search('embedding FAILED', reason);
      return {
        results: [],
        total: 0,
        query,
        searchType: 'failed',
        reason: `Impossible de générer l'embedding : ${reason}`,
      };
    }

    const results = searchSimilar(embedding, maxResults, 0.2);
    logger.search('results', { count: results.length, topScore: results[0]?.score ?? 0 });

    if (results.length === 0) {
      return {
        results: [],
        total: 0,
        query,
        searchType: 'vector',
        reason: 'Aucun résultat pertinent trouvé dans les documents indexés. Essaie une requête plus précise ou vérifie que les documents importés contiennent cette information.',
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
