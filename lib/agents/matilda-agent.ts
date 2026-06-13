import { type Tool, ToolLoopAgent, type InferAgentUIMessage, stepCountIs } from 'ai';
import { getModel } from '../provider';
import { getActiveProvider } from '../providers/registry';
import { getBoolean, getSetting } from '../settings';
import { searchDocuments } from '../tools/search-documents';
import { webSearch } from '../tools/web-search';
import { buildSystemPrompt } from './prompts';

const DEFAULT_TOOLS = { searchDocuments };
const WEB_TOOLS = { searchDocuments, webSearch };

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
  return new ToolLoopAgent({
    model: rest.model ?? getModel(),
    instructions: prompt,
    tools: rest.tools ?? (includeWebSearch ? WEB_TOOLS : DEFAULT_TOOLS),
    stopWhen: stepCountIs(rest.maxSteps ?? 10),
  });
}

export const matildaAgent = createAgent();

export type MatildaUIMessage = InferAgentUIMessage<typeof matildaAgent>;
