import { type ModelMessage } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { matildaAgent } from './agents/matilda-agent';
import type { Message } from './types';
import { generateId } from './utils';

type UseStreamChatOptions = {
  modelId?: string;
};

function toModelMessages(msgs: Message[]): ModelMessage[] {
  return msgs.map(({ role, content }) => ({ role, content }));
}

export function useStreamChat({ modelId: _modelId }: UseStreamChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<any>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: generateId(), role: 'user', content: trimmed };
    const assistantMsg: Message = { id: generateId(), role: 'assistant', content: '' };

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
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content };
          return next;
        });
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: `**Erreur** : ${err instanceof Error ? err.message : 'Une erreur est survenue'}`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return { messages, sendMessage, streaming, scrollRef };
}
