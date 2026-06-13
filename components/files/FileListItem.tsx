import { Feather } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Badge } from '../ui/Badge';
import type { FileItem } from '../../lib/types';
import { formatFileSize } from '../../lib/utils';

const STATUS_COLOR: Record<FileItem['status'], string> = {
  indexed: '#22C55E',
  indexing: '#3B82F6',
  pending: '#F97316',
  error: '#EF4444',
};

const STATUS_LABEL: Record<FileItem['status'], string> = {
  indexed: 'Indexé',
  indexing: 'Indexation...',
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
  onDelete?: () => void;
};

export function FileListItem({ item, onPress, onDelete }: FileListItemProps) {
  const translateX = useSharedValue(0);
  const deleteWidth = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const clamped = Math.min(Math.max(e.translationX, 0), deleteWidth.value);
      translateX.value = clamped;
    })
    .onEnd(() => {
      const t = translateX.value;
      if (t > 30 && deleteWidth.value > 0) {
        translateX.value = withSpring(deleteWidth.value);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const handleDelete = useCallback(() => {
    translateX.value = withSpring(0);
    onDelete?.();
  }, [onDelete, translateX]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="overflow-hidden">
      <View
        className="absolute inset-y-0 left-0 justify-center bg-danger"
        onLayout={(e) => { deleteWidth.value = e.nativeEvent.layout.width; }}
      >
        <TouchableOpacity onPress={handleDelete} className="px-5 py-4">
          <Feather name="trash-2" size={22} className="text-white" />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={rowStyle}>
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className="flex-row items-center py-4 px-4 bg-bg border-b border-border"
          >
            <View className="w-10 h-10 rounded-lg bg-surface items-center justify-center mr-3">
              <Feather name={FILE_ICON[item.type]} size={20} color={STATUS_COLOR[item.status]} />
            </View>

            <View className="flex-1 mr-3">
              <Text className="text-text-primary text-sm font-medium" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-text-muted text-xs mt-0.5" numberOfLines={1}>
                {formatFileSize(item.size)} · {item.date}
              </Text>
              {item.errorMessage && (
                <Text className="text-danger text-xs mt-0.5" numberOfLines={2}>
                  {item.errorMessage}
                </Text>
              )}
            </View>

            {item.status === 'indexing' ? (
              <ActivityIndicator size="small" className="text-info" />
            ) : (
              <Badge label={STATUS_LABEL[item.status]} color={STATUS_COLOR[item.status]} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
