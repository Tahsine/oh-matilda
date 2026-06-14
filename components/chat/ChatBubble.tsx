import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Feather } from '@expo/vector-icons';
import { useTokens } from '../../lib/theme-tokens';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  condensed?: boolean;
  onEdit?: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
};

export function ChatBubble({ role, content, image, condensed, onEdit, onCopy, onRegenerate }: ChatBubbleProps) {
  const t = useTokens();
  const mdStyles = {
    body: { color: t.textPrimary, fontSize: 16, lineHeight: 24, fontFamily: 'SpaceGrotesk' },
    code_inline: { fontFamily: 'JetBrainsMono', color: t.link, backgroundColor: t.codeBg, paddingHorizontal: 4, borderRadius: 4 },
    code_block: { fontFamily: 'JetBrainsMono', color: t.textPrimary, backgroundColor: t.codeBg, padding: 12, borderRadius: 8, marginVertical: 4 },
    fence: { fontFamily: 'JetBrainsMono', color: t.textPrimary, backgroundColor: t.codeBg, padding: 12, borderRadius: 8, marginVertical: 4 },
    link: { color: t.link },
    paragraph: { marginVertical: 2 },
    heading1: { color: t.heading, fontSize: 20, marginVertical: 4, fontFamily: 'SpaceGrotesk' },
    heading2: { color: t.heading, fontSize: 18, marginVertical: 4, fontFamily: 'SpaceGrotesk' },
    heading3: { color: t.heading, fontSize: 16, marginVertical: 4, fontFamily: 'SpaceGrotesk' },
    blockquote: { borderLeftColor: t.blockquoteBorder, borderLeftWidth: 3, paddingLeft: 8, marginVertical: 4, backgroundColor: 'transparent' },
  };

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
      <Markdown style={mdStyles}>{content || '...'}</Markdown>
      <View className="flex-row items-center gap-3 mt-2">
        <TouchableOpacity onPress={onCopy} className="p-1.5">
          <Feather name="copy" size={16} color={t.icon} />
        </TouchableOpacity>
        {!condensed && onRegenerate && (
          <TouchableOpacity onPress={onRegenerate} className="p-1.5">
            <Feather name="refresh-cw" size={16} color={t.icon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
