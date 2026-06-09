import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatBubble } from "../components/chat/ChatBubble";
import { ChatInput } from "../components/chat/ChatInput";
import { generateId } from "../lib/utils";
import type { Message } from "../lib/types";

const HINT = `Implémentation de **Matilda** en cours, veuillez réessayer plus tard.`;

export default function Index() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');

    const userMsg: Message = { id: generateId(), role: 'user', content: text };
    const assistantMsg: Message = { id: generateId(), role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    let index = 0;
    const chars = HINT.split('');

    const interval = setInterval(() => {
      if (index < chars.length) {
        const char = chars[index];
        index++;
        setMessages(prev => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          last.content += char;
          next[next.length - 1] = last;
          return next;
        });
        scrollRef.current?.scrollToEnd({ animated: true });
      } else {
        clearInterval(interval);
        setStreaming(false);
      }
    }, 15);
  }, [input, streaming]);

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-neutral-800">
        <TouchableOpacity onPress={() => router.push('/history')}>
          <Feather name="menu" size={24} color="#D4D4D4" />
        </TouchableOpacity>

        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.push('/files')}>
            <Feather name="folder" size={22} color="#D4D4D4" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Feather name="settings" size={22} color="#D4D4D4" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 16 }}
      >
        {messages.length === 0 && (
          <View className="flex-1 items-center justify-center px-4 pt-20">
            <Text className="text-neutral-500 text-center text-sm">
              Oh Matilda - Agentic & Offline First
            </Text>
            <Text className="text-neutral-600 text-center text-xs mt-2">
              Posez une question ou importez un document
            </Text>
          </View>
        )}

        {messages.map(msg => (
          <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
      </ScrollView>

      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        streaming={streaming}
      />
    </SafeAreaView>
  );
}
