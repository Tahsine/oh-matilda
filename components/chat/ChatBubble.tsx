import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Feather } from '@expo/vector-icons';
import { showToast } from '../ui/Toast';
import { useTokens } from '../../lib/theme-tokens';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  condensed?: boolean;
  durationMs?: number;
  tokenCount?: number;
  onEdit?: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
};

const markdownStyles = {
  body: { color: '#E4E4E7', fontSize: 16, lineHeight: 24, fontFamily: 'SpaceGrotesk' },
  code_inline: { fontFamily: 'JetBrainsMono', color: '#A78BFA', backgroundColor: '#2A2A2A', paddingHorizontal: 4, borderRadius: 4 },
  code_block: { fontFamily: 'JetBrainsMono', color: '#E4E4E7', backgroundColor: '#1A1A1A', padding: 12, borderRadius: 8, marginVertical: 4 },
  fence: { fontFamily: 'JetBrainsMono', color: '#E4E4E7', backgroundColor: '#1A1A1A', padding: 12, borderRadius: 8, marginVertical: 4 },
  link: { color: '#60A5FA' },
  paragraph: { marginVertical: 2 },
  heading1: { color: '#E4E4E7', fontSize: 20, marginVertical: 4, fontFamily: 'SpaceGrotesk' },
  heading2: { color: '#E4E4E7', fontSize: 18, marginVertical: 4, fontFamily: 'SpaceGrotesk' },
  heading3: { color: '#E4E4E7', fontSize: 16, marginVertical: 4, fontFamily: 'SpaceGrotesk' },
  blockquote: { borderLeftColor: '#525252', borderLeftWidth: 3, paddingLeft: 8, marginVertical: 4 },
};

function showInfoToast(role: string, durationMs?: number, tokenCount?: number) {
  const parts: string[] = [];
  if (tokenCount !== undefined) parts.push(`Tokens: ${tokenCount}`);
  if (durationMs !== undefined) parts.push(`Temps: ${durationMs}ms`);
  showToast(
    role === 'assistant' ? i18n.t('chat.bubble.infoTitleAssistant') : i18n.t('chat.bubble.infoTitleUser'),
    parts.join(' | ') || i18n.t('chat.bubble.noInfo'),
  );
}

export function ChatBubble({ role, content, image, condensed, durationMs, tokenCount, onEdit, onCopy, onRegenerate }: ChatBubbleProps) {
  const t = useTokens();

  if (role === 'user') {
    return (
      <View className="items-end px-4 py-1">
        <View className="bg-primary rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
          {image && (
            <Image source={{ uri: image }} className="w-48 h-48 rounded-xl mb-2" resizeMode="cover" />
          )}
          {content ? (
            <Text className="text-text-primary text-base leading-6 font-sans">{content}</Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-2 mt-1">
          {!condensed && onEdit && (
            <TouchableOpacity onPress={onEdit} className="p-1">
              <Feather name="edit-2" size={14} color={t.icon} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onCopy} className="p-1">
            <Feather name="copy" size={14} color={t.icon} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-1">
      <Markdown style={markdownStyles}>{content || '...'}</Markdown>
      <View className="flex-row items-center gap-3 mt-2">
        <TouchableOpacity onPress={onCopy} className="p-1.5">
          <Feather name="copy" size={16} color={t.icon} />
        </TouchableOpacity>
        {!condensed && onRegenerate && (
          <TouchableOpacity onPress={onRegenerate} className="p-1.5">
            <Feather name="refresh-cw" size={16} color={t.icon} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => showInfoToast(role, durationMs, tokenCount)} className="p-1.5">
          <Feather name="info" size={16} color={t.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
