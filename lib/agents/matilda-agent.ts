import { type Tool, ToolLoopAgent, type InferAgentUIMessage, stepCountIs } from 'ai';
import { getModel } from '../provider';
import { searchDocuments } from '../tools/search-documents';
import { webSearch } from '../tools/web-search';
import { MATILDA_SYSTEM_PROMPT, MATILDA_WEB_SEARCH_PROMPT } from './prompts';

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
  return new ToolLoopAgent({
    model: rest.model ?? getModel(),
    instructions: rest.systemPrompt ?? (includeWebSearch ? MATILDA_WEB_SEARCH_PROMPT : MATILDA_SYSTEM_PROMPT),
    tools: rest.tools ?? (includeWebSearch ? WEB_TOOLS : DEFAULT_TOOLS),
    stopWhen: stepCountIs(rest.maxSteps ?? 10),
  });
}

export const matildaAgent = createAgent();

export type MatildaUIMessage = InferAgentUIMessage<typeof matildaAgent>;
