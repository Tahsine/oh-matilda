import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from "react-native-safe-area-context";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const markdownStyles = {
  body: { color: '#E4E4E7', fontSize: 16, lineHeight: 24 },
  code_inline: { color: '#A78BFA', backgroundColor: '#2A2A2A', paddingHorizontal: 4, borderRadius: 4 },
  code_block: { color: '#E4E4E7', backgroundColor: '#2A2A2A', padding: 12, borderRadius: 8 },
  fence: { color: '#E4E4E7', backgroundColor: '#2A2A2A', padding: 12, borderRadius: 8 },
  link: { color: '#60A5FA' },
};

const HINT = `Implémentation de **Matilda** en cours, veuillez réessayer plus tard.`;

export default function Index() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    Keyboard.dismiss();
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
      {/* --- HEADER --- */}
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

      {/* --- MESSAGES --- */}
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
          <View
            key={msg.id}
            className="px-4 py-2"
          >
            {msg.role === 'user' ? (
              <Text className="text-white text-base leading-6">
                {msg.content}
              </Text>
            ) : (
              <Markdown style={markdownStyles}>
                {msg.content || '...'}
              </Markdown>
            )}
          </View>
        ))}
      </ScrollView>

      {/* --- CHAT INPUT (sticky au-dessus du clavier) --- */}
      <KeyboardStickyView offset={{ closed: 8, opened: 8 }}>
        <View className="bg-[#2A2A2A] rounded-[28px] mx-4 mb-2 p-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message Oh Matilda..."
            placeholderTextColor="#A3A3A3"
            multiline
            className="text-white text-base max-h-32 min-h-[40px] px-2"
            style={{ textAlignVertical: 'top' }}
          />

          <View className="flex-row justify-between items-center mt-2">
            <TouchableOpacity className="p-2">
              <Feather name="plus" size={24} color="#D4D4D4" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity className="p-2">
                <Feather name="mic" size={20} color="#D4D4D4" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || streaming}
                className="bg-slate-500 rounded-full h-10 w-10 items-center justify-center ml-1"
              >
                <Ionicons name="arrow-up" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}
