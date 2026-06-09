import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Conversation } from '../../lib/types';
import { formatRelativeDate } from '../../lib/utils';

type HistoryItemProps = {
  item: Conversation;
  onPress: () => void;
};

export function HistoryItem({ item, onPress }: HistoryItemProps) {
  return (
    <TouchableOpacity onPress={onPress} className="px-4 py-3">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-white text-base font-medium mb-1" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-neutral-500 text-sm" numberOfLines={1}>
            {item.preview}
          </Text>
        </View>
        <Text className="text-neutral-500 text-xs mt-1 shrink-0">
          {formatRelativeDate(item.date)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
