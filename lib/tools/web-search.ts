import { fetch as expoFetch } from 'expo/fetch';
import { tool } from 'ai';
import { z } from 'zod';
import { getSetting } from '../settings';

export function createWebSearch() {
  const apiKey = getSetting('tavily_api_key');
  if (!apiKey) {
    return tool({
      description: 'Real-time web search via Tavily (not configured)',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        maxResults: z.number().default(5).describe('Number of results (max 10)'),
      }),
      execute: async () => ({
        results: [],
        error: 'Tavily API key not configured. Add it in Settings > Tavily API Key.',
      }),
    });
  }

  return tool({
    description: 'Real-time web search via Tavily',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      maxResults: z.number().default(5).describe('Number of results (max 10)'),
    }),
    execute: async ({ query, maxResults }) => {
      console.log('[web-search] execute:', { query, maxResults });
      try {
        const response = await expoFetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
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
        return { results: [], error: e instanceof Error ? e.message : 'Unknown error' };
      }
    },
  });
}
