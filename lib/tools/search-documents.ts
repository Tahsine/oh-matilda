import { tool } from 'ai';
import { z } from 'zod';

export const searchDocuments = tool({
  description: 'Rechercher dans les documents importés par l\'utilisateur',
  inputSchema: z.object({
    query: z.string().describe('La requête de recherche'),
    maxResults: z.number().default(5).describe('Nombre maximum de résultats'),
  }),
  execute: async ({ query, maxResults }) => {
    // Phase 1: mock. Phase 2: sqlite-vec full-text search
    return {
      results: [],
      total: 0,
      query,
    };
  },
});
