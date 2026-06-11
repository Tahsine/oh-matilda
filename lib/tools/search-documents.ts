import { tool } from 'ai';
import { z } from 'zod';
import { searchDocumentText } from '../db';

export const searchDocuments = tool({
  description: 'Rechercher dans les documents importés par l\'utilisateur',
  inputSchema: z.object({
    query: z.string().describe('La requête de recherche'),
    maxResults: z.number().default(5).describe('Nombre maximum de résultats'),
  }),
  execute: async ({ query, maxResults }) => {
    const results = searchDocumentText(query);
    return {
      results: results.slice(0, maxResults),
      total: results.length,
      query,
    };
  },
});
