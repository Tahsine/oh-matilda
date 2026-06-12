import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { ErrorBanner } from '../components/ErrorBanner';
import { ThinkingIndicator } from '../components/chat/ThinkingIndicator';
import { onErrors, type AppError } from '../lib/error-handler';
import { useStreamChat } from '../lib/chat';

const SUGGESTIONS = [
  'Qu\'est-ce qui est traité dans mes documents ?',
  'Résume le document principal',
  'Quels sont les points importants ?',
];

export default function Index() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [errors, setErrors] = useState<AppError[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  useEffect(() => {
    const unsub = onErrors(setErrors);
    return unsub;
  }, []);

  const onConversationChange = useCallback(
    (conv: { id: string }) => {
      router.setParams({ id: conv.id });
    },
    [router],
  );

  const { messages, sendMessage, streaming } = useStreamChat({
    conversationId: id,
    onConversationChange,
    webSearchEnabled,
  });

  const lastMsg = messages[messages.length - 1];
  const showThinking = streaming && lastMsg?.role === 'assistant' && lastMsg.content === '';

  const contentRef = useRef<ScrollView>(null);
  const [scrolledUp, setScrolledUp] = useState(false);

  useEffect(() => {
    if (showThinking || messages.length > 0) {
      setTimeout(() => contentRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, showThinking]);

  useEffect(() => {
    setTimeout(() => contentRef.current?.scrollToEnd({ animated: false }), 50);
  }, [id]);

  const handleScroll = useCallback((e: any) => {
    const offset = e.nativeEvent.contentOffset.y;
    const contentHeight = e.nativeEvent.contentSize.height;
    const viewHeight = e.nativeEvent.layoutMeasurement.height;
    const nearBottom = contentHeight - offset - viewHeight < 80;
    setScrolledUp(!nearBottom);
  }, []);

  const scrollToBottom = () => {
    contentRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
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

      <View className="flex-1 relative">
      {errors.length > 0 && <ErrorBanner error={errors[errors.length - 1]} />}
      <ScrollView
        ref={contentRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        {messages.length === 0 && !streaming && (
          <View className="flex-1 items-center justify-center px-4 pt-24">
            <Image
              source={require('../assets/images/icon.png')}
              style={{ width: 72, height: 72 }}
              className="mb-6"
            />
            <Text className="text-white text-xl font-semibold mb-2 font-sans">
              Oh Matilda
            </Text>
            <Text className="text-neutral-400 text-center text-sm mb-8 max-w-xs font-sans">
              Agentic & Offline First — Posez une question ou importez un document
            </Text>

            <View className="w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => sendMessage(s)}
                  className="border border-neutral-700 rounded-xl px-4 py-3"
                >
                  <Text className="text-neutral-300 text-sm font-sans">{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant';
          if (isLastAssistant && streaming && msg.content === '') return null;
          return <ChatBubble key={msg.id} role={msg.role} content={msg.content} image={msg.image} />;
        })}

        {showThinking && <ThinkingIndicator />}
      </ScrollView>

      {scrolledUp && messages.length > 0 && (
        <TouchableOpacity
          onPress={scrollToBottom}
          className="absolute bottom-4 right-4 bg-slate-500 rounded-full w-10 h-10 items-center justify-center shadow-lg shadow-black/50"
        >
          <Feather name="chevron-down" size={22} color="white" />
        </TouchableOpacity>
      )}
      </View>

      <ChatInput
        onSend={sendMessage}
        streaming={streaming}
        webSearch={webSearchEnabled}
        onToggleWebSearch={() => setWebSearchEnabled(v => !v)}
      />
    </SafeAreaView>
  );
}
