import { fetch as expoFetch } from 'expo/fetch';
import { tool } from 'ai';
import { z } from 'zod';

export const webSearch = tool({
  description: 'Recherche web en temps réel via Tavily',
  parameters: z.object({
    query: z.string().describe('La requête de recherche'),
    maxResults: z.number().default(5).describe('Nombre de résultats (max 10)'),
  }),
  execute: async ({ query, maxResults }) => {
    console.log('[web-search] execute:', { query, maxResults });
    try {
      const response = await expoFetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.EXPO_PUBLIC_TAVILY_API_KEY,
          query,
          max_results: Math.min(maxResults, 10),
          search_depth: 'advanced',
          include_answer: true,
        }),
      });
      const data = await response.json();
      console.log('[web-search] response:', JSON.stringify(data).slice(0, 200));
      return data;
    } catch (e) {
      console.error('[web-search] error:', e);
      return { results: [], error: e instanceof Error ? e.message : 'Erreur inconnue' };
    }
  },
});
