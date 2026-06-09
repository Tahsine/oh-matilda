import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from 'ai';
import { getModel } from '../provider';
import { searchDocuments } from '../tools/search-documents';

export const matildaAgent = new ToolLoopAgent({
  model: getModel(),
  instructions: `Tu es Matilda, un assistant IA spécialisé dans l'analyse de documents.
Tu fonctionnes entièrement en local sur l'appareil de l'utilisateur.
Tu as accès à ses documents importés (PDF, Word) pour faire des recherches et analyses.

Règles :
- Réponds toujours en français, de façon concise et utile
- Si tu ne trouves pas l'information, dis-le clairement
- Utilise l'outil searchDocuments pour chercher dans les documents
- Sois précis et cite tes sources quand c'est pertinent`,
  tools: {
    searchDocuments,
  },
  stopWhen: stepCountIs(10),
});

export type MatildaUIMessage = InferAgentUIMessage<typeof matildaAgent>;
