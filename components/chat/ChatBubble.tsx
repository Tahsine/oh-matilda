import React from 'react';
import { Image, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
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

export function ChatBubble({ role, content, image }: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <View className="flex-row justify-end px-4 py-1">
        <View className="bg-primary rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
          {image && (
            <Image source={{ uri: image }} className="w-48 h-48 rounded-xl mb-2" resizeMode="cover" />
          )}
          {content ? (
            <Text className="text-text-primary text-base leading-6 font-sans">{content}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View className="px-4 py-1">
      <Markdown style={markdownStyles}>{content || '...'}</Markdown>
    </View>
  );
}
