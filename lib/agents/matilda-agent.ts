import { type Tool, ToolLoopAgent, type InferAgentUIMessage, type ModelMessage, stepCountIs } from 'ai';
import { getModel } from '../provider';
import { getActiveProvider } from '../providers/registry';
import { getBoolean, getSetting } from '../settings';
import { searchDocuments } from '../tools/search-documents';
import { createWebSearch } from '../tools/web-search';
import { buildSystemPrompt } from './prompts';

const DEFAULT_TOOLS = { searchDocuments };

export function createAgent(config?: {
  model?: ReturnType<typeof getModel>;
  tools?: Record<string, Tool>;
  systemPrompt?: string;
  maxSteps?: number;
  includeWebSearch?: boolean;
}) {
  const { includeWebSearch, ...rest } = config ?? {};
  const thinking = getBoolean('reasoning') && getActiveProvider().provider === 'llama-local';
  const customPrompt = getSetting('custom_prompt');
  const prompt = rest.systemPrompt ?? buildSystemPrompt({ thinking, webSearch: !!includeWebSearch, customPrompt });

  const tools = rest.tools ?? (includeWebSearch ? { searchDocuments, webSearch: createWebSearch() } : DEFAULT_TOOLS);

  let correctionCount = 0;

  return new ToolLoopAgent({
    model: rest.model ?? getModel(),
    instructions: prompt,
    tools,
    stopWhen: stepCountIs(rest.maxSteps ?? 10),
    prepareStep: async ({ steps, messages }) => {
      if (steps.length === 0) return {};

      const last = steps[steps.length - 1];
      const searchCalls = last.toolResults.filter(
        (r: any) => r.toolName === 'searchDocuments',
      );
      if (searchCalls.length === 0) return {};

      const allLow = searchCalls.every((r: any) => {
        const out = r.output as any;
        if (!out?.results || out.results.length === 0) return true;
        return out.results.every((rr: any) => rr.score < 0.5);
      });

      if (allLow && correctionCount < 2) {
        correctionCount++;
        return {
          messages: [
            ...messages,
            { role: 'user', content: '⚠️ Previous results have low relevance (score < 0.5). Rephrase your search with more specific terms and use searchDocuments again.' } as ModelMessage,
          ],
        };
      }

      return {};
    },
  });
}

export const matildaAgent = createAgent();

export type MatildaUIMessage = InferAgentUIMessage<typeof matildaAgent>;
