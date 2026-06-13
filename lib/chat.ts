import * as FileSystem from 'expo-file-system/legacy';
import { type TextPart, type ImagePart, type ModelMessage } from 'ai';
type ContentPart = TextPart | ImagePart;
import { useCallback, useEffect, useRef, useState } from 'react';
import { createAgent } from './agents/matilda-agent';
import {
  addMessage,
  createConversation,
  deleteMessage,
  deleteMessagesAfter,
  getConversationSummary,
  getMessages,
  getTokenUsage,
  markMessagesCondensed,
  setConversationSummary,
  updateConversation,
  updateMessageContent,
  updateTokenUsage,
} from './db';
import { pushError } from './error-handler';
import { getSetting } from './settings';
import type { Conversation, Message } from './types';
import { generateId } from './utils';

async function uriToDataUrl(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpeg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

type UseStreamChatOptions = {
  conversationId?: string;
  onConversationChange?: (conv: Conversation) => void;
  webSearchEnabled?: boolean;
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function toModelMessages(msgs: Message[], webSearch?: boolean): Promise<ModelMessage[]> {
  const result: ModelMessage[] = [];
  for (const msg of msgs) {
    const prefix = msg.role === 'user' && webSearch ? '[Recherche Web] ' : '';
    if (!msg.image) {
      result.push({ role: msg.role, content: prefix + msg.content });
    } else {
      const dataUrl = await uriToDataUrl(msg.image);
      const parts: ContentPart[] = [
        { type: 'text' as const, text: prefix + msg.content },
        { type: 'image' as const, image: dataUrl },
      ];
      result.push({ role: msg.role as 'user' | 'assistant', content: parts } as ModelMessage);
    }
  }
  return result;
}

function needsCompaction(convId: string): boolean {
  const used = getTokenUsage(convId);
  const ctx = parseInt(getSetting('llm_n_ctx'), 10) || 4096;
  return used > ctx * 0.8;
}

async function compactConversation(convId: string, messages: Message[]): Promise<void> {
  const assistantIndices: number[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'assistant') assistantIndices.push(i);
  });
  if (assistantIndices.length <= 6) return;

  const cutoffIndex = assistantIndices[assistantIndices.length - 6];
  const toSummarize = messages.slice(0, cutoffIndex);

  const summaryPrompt = `Tu es un assistant spécialisé dans le résumé de conversations. Résume la conversation suivante entre l'utilisateur et un assistant IA en 2-3 phrases concises. Garde les points clés, les décisions et les informations importantes. Ignore les salutations et le superflu.

Conversation :
${toSummarize.map((m) => `**${m.role === 'user' ? 'Utilisateur' : 'Assistant'}** : ${m.content}`).join('\n\n')}

Résumé :`;

  try {
    const agent = createAgent();
    const result = await agent.stream({ messages: [{ role: 'user', content: summaryPrompt } as ModelMessage] });
    let summary = '';
    for await (const chunk of result.textStream) {
      summary += chunk;
    }
    setConversationSummary(convId, summary.trim());
    markMessagesCondensed(convId, messages[cutoffIndex].id);
  } catch (err) {
    console.error('[chat] compaction error:', err);
  }
}

export function useStreamChat({ conversationId, onConversationChange, webSearchEnabled = false }: UseStreamChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId);
  const [streaming, setStreaming] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const scrollRef = useRef<any>(null);
  const isNewConversation = useRef(false);
  const webSearchRef = useRef(webSearchEnabled);
  const abortRef = useRef<AbortController | null>(null);
  const lastDurationRef = useRef(0);
  const lastTokensRef = useRef(0);
  webSearchRef.current = webSearchEnabled;

  const cancelStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const streamToMessage = async (convId: string, assistantMsgId: string, agentMsgs: ModelMessage[], title?: string) => {
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const start = Date.now();
    try {
      const agent = createAgent({ includeWebSearch: webSearchRef.current });
      const result = await agent.stream({ messages: agentMsgs, abortSignal: controller.signal });

      let content = '';
      for await (const chunk of result.textStream) {
        if (controller.signal.aborted) break;
        content += chunk;
        updateMessageContent(convId, assistantMsgId, content);
        setMessages(prev => {
          const next = [...prev];
          const idx = next.findIndex(m => m.id === assistantMsgId);
          if (idx !== -1) next[idx] = { ...next[idx], content };
          return next;
        });
      }

      const elapsed = Date.now() - start;
      lastDurationRef.current = elapsed;
      lastTokensRef.current = estimateTokens(content);

      updateConversation(convId, {
        title,
        preview: content.slice(0, 120),
        date: new Date(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[chat] generation stopped by user');
      } else {
        console.error('[chat] stream error:', err);
        const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
        pushError({ type: 'agent', message: msg });
        const errMsg = `**Erreur** : ${msg}`;
        updateMessageContent(convId, assistantMsgId, errMsg);
        setMessages(prev => {
          const next = [...prev];
          const idx = next.findIndex(m => m.id === assistantMsgId);
          if (idx !== -1) next[idx] = { ...next[idx], content: errMsg };
          return next;
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  };

  useEffect(() => {
    if (conversationId) {
      const msgs = getMessages(conversationId);
      setMessages(msgs);
      setActiveConversationId(conversationId);
    } else {
      setMessages([]);
      setActiveConversationId(undefined);
    }
    isNewConversation.current = false;
  }, [conversationId]);

  const sendMessage = useCallback(async (text: string, image?: string) => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    console.log('[chat] sendMessage text:', trimmed.slice(0, 80), 'image:', !!image, 'webSearch:', webSearchRef.current);

    let convId = activeConversationId;

    if (!convId) {
      const conv = createConversation();
      convId = conv.id;
      isNewConversation.current = true;
      setActiveConversationId(convId);
      onConversationChange?.(conv);
      console.log('[chat] new conversation:', convId);
    }

    const userMsg: Message = { id: generateId(), role: 'user', content: trimmed, image };
    const assistantMsg: Message = { id: generateId(), role: 'assistant', content: '' };

    addMessage(convId, userMsg);
    addMessage(convId, assistantMsg);
    setMessages(prev => {
      const updated = [...prev, userMsg, assistantMsg];
      // Reload messages from DB to pick up condensed marks
      return getMessages(convId);
    });

    // Compaction check
    if (needsCompaction(convId) && messages.length > 6) {
      setCompacting(true);
      const currentMsgs = getMessages(convId);
      await compactConversation(convId, currentMsgs);
      setCompacting(false);
    }

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const title = messages.length === 0 ? trimmed.slice(0, 60) : undefined;

    try {
      const summary = getConversationSummary(convId);
      const agentMsgs: ModelMessage[] = summary
        ? [{ role: 'system', content: `Résumé de la conversation précédente : ${summary}` }]
        : [];

      const historyMsgs = messages.length > 0 ? await toModelMessages(messages, webSearchRef.current) : [];
      agentMsgs.push(...historyMsgs);

      const userPrefix = webSearchRef.current ? '[Recherche Web] ' : '';
      let userContent: ModelMessage['content'];
      if (image) {
        const dataUrl = await uriToDataUrl(image);
        const parts: ContentPart[] = [
          { type: 'text' as const, text: userPrefix + trimmed },
          { type: 'image' as const, image: dataUrl },
        ];
        userContent = parts;
      } else {
        userContent = userPrefix + trimmed;
      }
      agentMsgs.push({ role: 'user', content: userContent } as ModelMessage);

      const agent = createAgent({ includeWebSearch: webSearchRef.current });
      console.log('[chat] agent created, calling agent.stream...');
      const start = Date.now();
      const result = await agent.stream({
        messages: agentMsgs,
        abortSignal: controller.signal,
      });
      console.log('[chat] agent.stream returned after', Date.now() - start, 'ms');

      let content = '';
      let chunkCount = 0;
      for await (const chunk of result.textStream) {
        if (controller.signal.aborted) break;
        chunkCount++;
        content += chunk;
        updateMessageContent(convId, assistantMsg.id, content);
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content };
          return next;
        });
      }
      console.log('[chat] stream finished, chunks:', chunkCount, 'total chars:', content.length);
      console.log('[chat] final content:', content.slice(0, 200));

      const elapsed = Date.now() - start;
      lastDurationRef.current = elapsed;
      lastTokensRef.current = estimateTokens(content);

      // Accumulate token usage
      const prevUsage = getTokenUsage(convId);
      updateTokenUsage(convId, prevUsage + lastTokensRef.current);

      updateConversation(convId, {
        title: title?.length ? title : undefined,
        preview: content.slice(0, 120),
        date: new Date(),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[chat] generation stopped by user');
      } else {
        console.error('[chat] stream error:', err);
        const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
        pushError({ type: 'agent', message: msg });
        const errMsg = `**Erreur** : ${msg}`;
        updateMessageContent(convId, assistantMsg.id, errMsg);
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: errMsg };
          return next;
        });
      }
    } finally {
      abortRef.current = null;
      console.log('[chat] streaming finished, setting streaming=false');
      setStreaming(false);
      // Reload to pick up condensed marks
      setMessages(getMessages(convId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, messages, onConversationChange]);

  const regenerateResponse = useCallback(async () => {
    if (!activeConversationId || streaming) return;
    const currentMessages = getMessages(activeConversationId);
    const lastAssistant = currentMessages[currentMessages.length - 1];
    if (!lastAssistant || lastAssistant.role !== 'assistant') return;

    deleteMessage(activeConversationId, lastAssistant.id);

    const newAssistant: Message = { id: generateId(), role: 'assistant', content: '' };
    addMessage(activeConversationId, newAssistant);

    setMessages(prev => {
      const chopped = prev.filter(m => m.id !== lastAssistant.id);
      return [...chopped, newAssistant];
    });

    const remaining = getMessages(activeConversationId).filter(m => m.id !== newAssistant.id);
    const agentMsgs = await toModelMessages(remaining, webSearchRef.current);

    setRegenerating(true);
    try {
      await streamToMessage(activeConversationId, newAssistant.id, agentMsgs);
    } finally {
      setRegenerating(false);
    }
  }, [activeConversationId, streaming]);

  const editAndResend = useCallback(async (msgId: string, newText: string) => {
    if (!activeConversationId || streaming) return;

    updateMessageContent(activeConversationId, msgId, newText);
    deleteMessagesAfter(activeConversationId, msgId);

    const newAssistant: Message = { id: generateId(), role: 'assistant', content: '' };
    addMessage(activeConversationId, newAssistant);

    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId);
      if (idx === -1) return [...prev, newAssistant];
      return [...prev.slice(0, idx), { ...prev[idx], content: newText }, newAssistant];
    });

    const remaining = getMessages(activeConversationId).filter(m => m.id !== newAssistant.id);
    const agentMsgs = await toModelMessages(remaining, webSearchRef.current);

    const title = remaining.length <= 2 ? newText.slice(0, 60) : undefined;
    await streamToMessage(activeConversationId, newAssistant.id, agentMsgs, title);
  }, [activeConversationId, streaming]);

  return {
    messages,
    sendMessage,
    streaming,
    compacting,
    regenerating,
    scrollRef,
    activeConversationId,
    regenerateResponse,
    editAndResend,
    cancelStreaming,
    lastDurationMs: lastDurationRef.current,
    lastTokenCount: lastTokensRef.current,
  };
}