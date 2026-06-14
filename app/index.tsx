import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { ErrorBanner } from '../components/ErrorBanner';
import { ThinkingIndicator } from '../components/chat/ThinkingIndicator';
import { showToast } from '../components/ui/Toast';
import { onErrors, type AppError } from '../lib/error-handler';
import { useStreamChat } from '../lib/chat';
import { getMessages } from '../lib/db';
import { getSetting, setSetting } from '../lib/settings';
import type { Message } from '../lib/types';
import { useTokens } from '../lib/theme-tokens';

const SUGGESTION_KEYS = ['chat.suggestions.0', 'chat.suggestions.1', 'chat.suggestions.2'];

export default function Index() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [errors, setErrors] = useState<AppError[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [showTavilyKeyModal, setShowTavilyKeyModal] = useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = useState('');
  const t = useTokens();
  const suggestions = SUGGESTION_KEYS.map(k => tr(k));

  useEffect(() => {
    const unsub = onErrors(setErrors);
    return () => { unsub(); };
  }, []);

  const onConversationChange = useCallback(
    (conv: { id: string }) => {
      router.setParams({ id: conv.id });
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      if (id && getMessages(id).length === 0) {
        router.replace('/');
      }
    }, [id]),
  );

  const { messages, sendMessage, streaming, compacting, regenerating, regenerateResponse, editAndResend, cancelStreaming } = useStreamChat({
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

  const handleCopy = useCallback(async (content: string) => {
    await Clipboard.setStringAsync(content);
    showToast(tr('toast.copied'), tr('toast.copiedDesc'));
  }, [tr]);

  const handleEdit = useCallback((msgId: string, newText: string) => {
    setEditingMessage(null);
    editAndResend(msgId, newText);
  }, [editAndResend]);

  const handleToggleWebSearch = useCallback(() => {
    const key = getSetting('tavily_api_key');
    if (!key) {
      setTavilyKeyInput('');
      setShowTavilyKeyModal(true);
      return;
    }
    setWebSearchEnabled(v => !v);
  }, []);

  const handleSaveTavilyKey = useCallback(() => {
    const trimmed = tavilyKeyInput.trim();
    if (!trimmed) return;
    setSetting('tavily_api_key', trimmed);
    setShowTavilyKeyModal(false);
    setWebSearchEnabled(true);
    showToast(tr('toast.tavilySaved'), tr('toast.tavilyWebSearchActive'));
  }, [tavilyKeyInput, tr]);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.push('/history')}>
          <Feather name="menu" size={24} color={t.icon} />
        </TouchableOpacity>

        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.push('/files')}>
            <Feather name="folder" size={22} color={t.icon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Feather name="settings" size={22} color={t.icon} />
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
            <Text className="text-text-primary text-xl font-semibold mb-2 font-sans">
              {tr('chat.emptyTitle')}
            </Text>
            <Text className="text-text-secondary text-center text-sm mb-8 max-w-xs font-sans">
              {tr('chat.emptySubtitle')}
            </Text>

            <View className="w-full gap-2">
              {suggestions.map((s) => (
                  <TouchableOpacity
                  key={s}
                  onPress={() => sendMessage(s)}
                  className="border border-border rounded-xl px-4 py-3"
                >
                  <Text className="text-text-muted text-sm font-sans">{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant';
          if (isLastAssistant && streaming && msg.content === '') return null;
          return (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              image={msg.image}
              condensed={msg.condensed}
              onEdit={msg.role === 'user' && !msg.condensed ? () => setEditingMessage({ id: msg.id, text: msg.content }) : undefined}
              onCopy={() => handleCopy(msg.content)}
              onRegenerate={msg.role === 'assistant' && isLastAssistant ? () => regenerateResponse?.() : undefined}
            />
          );
        })}

        {showThinking && <ThinkingIndicator text={compacting ? tr('chat.compacting') : regenerating ? tr('chat.regenerating') : undefined} />}
      </ScrollView>

      {scrolledUp && messages.length > 0 && (
        <TouchableOpacity
          onPress={scrollToBottom}
          className="absolute bottom-4 right-4 bg-primary rounded-full w-10 h-10 items-center justify-center shadow-lg shadow-black/50"
        >
          <Feather name="chevron-down" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      </View>

      <Modal visible={showTavilyKeyModal} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-overlay justify-center px-6"
          activeOpacity={1}
          onPress={() => setShowTavilyKeyModal(false)}
        >
          <View className="bg-surface rounded-2xl p-5">
            <Text className="text-text-primary text-lg font-semibold text-center mb-1">
              {tr('chat.tavilyModal.title')}
            </Text>
            <Text className="text-text-secondary text-sm text-center mb-4">
              {tr('chat.tavilyModal.description')}
            </Text>
            <TextInput
              value={tavilyKeyInput}
              onChangeText={setTavilyKeyInput}
              placeholder={tr('chat.tavilyModal.placeholder')}
              placeholderTextColor="#525252"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className="text-text-primary text-base bg-bg rounded-xl px-4 py-3 mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowTavilyKeyModal(false)}
                className="flex-1 py-3 rounded-xl bg-surface items-center"
              >
                <Text className="text-text-primary text-base">{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveTavilyKey}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-white text-base font-semibold">{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ChatInput
        onSend={sendMessage}
        streaming={streaming}
        onStop={cancelStreaming}
        webSearch={webSearchEnabled}
        onToggleWebSearch={handleToggleWebSearch}
        editTarget={editingMessage}
        onEdit={handleEdit}
        onCancelEdit={() => setEditingMessage(null)}
      />
    </SafeAreaView>
  );
}
