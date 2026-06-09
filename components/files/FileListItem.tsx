import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Badge } from '../ui/Badge';
import type { FileItem } from '../../lib/types';

const STATUS_COLOR: Record<FileItem['status'], string> = {
  indexed: '#22C55E',
  pending: '#F97316',
  error: '#EF4444',
};

const STATUS_LABEL: Record<FileItem['status'], string> = {
  indexed: 'Indexé',
  pending: 'En cours',
  error: 'Erreur',
};

const FILE_ICON: Record<FileItem['type'], keyof typeof Feather.glyphMap> = {
  pdf: 'file-text',
  docx: 'file',
};

type FileListItemProps = {
  item: FileItem;
  onPress?: () => void;
};

export function FileListItem({ item, onPress }: FileListItemProps) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center py-4 border-b border-neutral-800/60">
      <View className="w-10 h-10 rounded-lg bg-[#2A2A2A] items-center justify-center mr-3">
        <Feather name={FILE_ICON[item.type]} size={20} color={STATUS_COLOR[item.status]} />
      </View>

      <View className="flex-1 mr-3">
        <Text className="text-white text-sm font-medium" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-neutral-500 text-xs mt-0.5">
          {item.size} · {item.date}
        </Text>
      </View>

      <Badge label={STATUS_LABEL[item.status]} color={STATUS_COLOR[item.status]} />
    </TouchableOpacity>
  );
}
