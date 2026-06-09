import React from 'react';
import { Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
};

const markdownStyles = {
  body: { color: '#E4E4E7', fontSize: 16, lineHeight: 24 },
  code_inline: { color: '#A78BFA', backgroundColor: '#2A2A2A', paddingHorizontal: 4, borderRadius: 4 },
  code_block: { color: '#E4E4E7', backgroundColor: '#2A2A2A', padding: 12, borderRadius: 8 },
  fence: { color: '#E4E4E7', backgroundColor: '#2A2A2A', padding: 12, borderRadius: 8 },
  link: { color: '#60A5FA' },
};

export function ChatBubble({ role, content }: ChatBubbleProps) {
  return (
    <View className="px-4 py-2">
      {role === 'user' ? (
        <Text className="text-white text-base leading-6">{content}</Text>
      ) : (
        <Markdown style={markdownStyles}>{content || '...'}</Markdown>
      )}
    </View>
  );
}
