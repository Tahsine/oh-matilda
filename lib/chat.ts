import * as FileSystem from 'expo-file-system/legacy';
import { type ModelMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createAgent } from './agents/matilda-agent';
import {
  addMessage,
  createConversation,
  getMessages,
  updateConversation,
  updateMessageContent,
} from './db';
import { pushError } from './error-handler';
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

type ContentPart = NonNullable<ModelMessage['content']> extends Array<infer U> ? U : never;

type UseStreamChatOptions = {
  conversationId?: string;
  onConversationChange?: (conv: Conversation) => void;
  webSearchEnabled?: boolean;
};

async function toModelMessages(msgs: Message[]): Promise<ModelMessage[]> {
  const result: ModelMessage[] = [];
  for (const msg of msgs) {
    if (!msg.image) {
      result.push({ role: msg.role, content: msg.content });
    } else {
      const dataUrl = await uriToDataUrl(msg.image);
      const parts: ContentPart[] = [
        { type: 'text' as const, text: msg.content },
        { type: 'image' as const, image: dataUrl },
      ];
      result.push({ role: msg.role as 'user' | 'assistant', content: parts });
    }
  }
  return result;
}

export function useStreamChat({ conversationId, onConversationChange, webSearchEnabled = false }: UseStreamChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<any>(null);
  const isNewConversation = useRef(false);

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
    console.log('[chat] sendMessage text:', trimmed.slice(0, 80), 'image:', !!image, 'webSearch:', webSearchEnabled);

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
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const title = messages.length === 0 ? trimmed.slice(0, 60) : undefined;

    try {
      const agentMsgs = messages.length > 0
        ? await toModelMessages(messages)
        : [];
      console.log('[chat] history messages:', agentMsgs.length);

      let userContent: ModelMessage['content'];
      if (image) {
        const dataUrl = await uriToDataUrl(image);
        const parts: ContentPart[] = [
          { type: 'text' as const, text: trimmed },
          { type: 'image' as const, image: dataUrl },
        ];
        userContent = parts;
      } else {
        userContent = trimmed;
      }

      const agent = createAgent({ includeWebSearch: webSearchEnabled });
      console.log('[chat] agent created, calling agent.stream...');
      const start = Date.now();
      const result = await agent.stream({
        messages: [...agentMsgs, { role: 'user', content: userContent } as ModelMessage],
      });
      console.log('[chat] agent.stream returned after', Date.now() - start, 'ms');

      let content = '';
      let chunkCount = 0;
      for await (const chunk of result.textStream) {
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

      updateConversation(convId, {
        title: title?.length ? title : undefined,
        preview: content.slice(0, 120),
        date: new Date(),
      });
    } catch (err) {
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
    } finally {
      console.log('[chat] streaming finished, setting streaming=false');
      setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, messages, onConversationChange]);

  return {
    messages,
    sendMessage,
    streaming,
    scrollRef,
    activeConversationId,
  };
}
