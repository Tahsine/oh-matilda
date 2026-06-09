import { type ModelMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { matildaAgent } from './agents/matilda-agent';
import {
  addMessage,
  createConversation,
  getMessages,
  updateConversation,
  updateMessageContent,
} from './db';
import type { Conversation, Message } from './types';
import { generateId } from './utils';

type UseStreamChatOptions = {
  conversationId?: string;
  onConversationChange?: (conv: Conversation) => void;
};

function toModelMessages(msgs: Message[]): ModelMessage[] {
  return msgs.map(({ role, content }) => ({ role, content }));
}

export function useStreamChat({ conversationId, onConversationChange }: UseStreamChatOptions = {}) {
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

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let convId = activeConversationId;

    if (!convId) {
      const conv = createConversation();
      convId = conv.id;
      isNewConversation.current = true;
      setActiveConversationId(convId);
      onConversationChange?.(conv);
    }

    const userMsg: Message = { id: generateId(), role: 'user', content: trimmed };
    const assistantMsg: Message = { id: generateId(), role: 'assistant', content: '' };

    addMessage(convId, userMsg);
    addMessage(convId, assistantMsg);
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const agentMsgs = messages.length > 0
        ? toModelMessages(messages)
        : [];

      const result = await matildaAgent.stream({
        messages: [...agentMsgs, { role: 'user', content: trimmed } as ModelMessage],
      });

      let content = '';
      for await (const chunk of result.textStream) {
        content += chunk;
        updateMessageContent(convId, assistantMsg.id, content);
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content };
          return next;
        });
      }

      const title = messages.length === 0
        ? trimmed.slice(0, 60)
        : undefined;

      updateConversation(convId, {
        title: title?.length ? title : undefined,
        preview: content.slice(0, 120),
        date: new Date(),
      });
    } catch (err) {
      const errMsg = `**Erreur** : ${err instanceof Error ? err.message : 'Une erreur est survenue'}`;
      updateMessageContent(convId, assistantMsg.id, errMsg);
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: errMsg,
        };
        return next;
      });
    } finally {
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
