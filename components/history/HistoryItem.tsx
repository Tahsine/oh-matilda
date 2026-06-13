import { Feather } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { Conversation } from '../../lib/types';
import { formatRelativeDate } from '../../lib/utils';

type HistoryItemProps = {
  item: Conversation;
  onPress: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onRename: (title: string) => void;
};

export function HistoryItem({ item, onPress, onDelete, onToggleFavorite, onRename }: HistoryItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.title);
  const translateX = useSharedValue(0);
  const leftW = useSharedValue(0);
  const rightW = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const clamped = Math.min(Math.max(e.translationX, -rightW.value), leftW.value);
      translateX.value = clamped;
    })
    .onEnd(() => {
      const t = translateX.value;
      if (t > 30 && leftW.value > 0) {
        translateX.value = withSpring(leftW.value);
      } else if (t < -30 && rightW.value > 0) {
        translateX.value = withSpring(-rightW.value);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .onEnd(() => {
      const t = translateX.value;
      if (Math.abs(t) < 20) {
        runOnJS(onPress)();
      }
    });

  const composed = Gesture.Race(panGesture, tapGesture);

  const resetSwipe = useCallback(() => {
    translateX.value = withSpring(0);
  }, [translateX]);

  const handleDelete = useCallback(() => {
    resetSwipe();
    onDelete();
  }, [onDelete, resetSwipe]);

  const handleToggleFavorite = useCallback(() => {
    resetSwipe();
    onToggleFavorite();
  }, [onToggleFavorite, resetSwipe]);

  const handleSubmitRename = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.title) {
      onRename(trimmed);
    } else {
      setEditText(item.title);
    }
    setEditing(false);
  };

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="overflow-hidden">
      <View
        className="absolute inset-y-0 left-0 justify-center bg-danger"
        onLayout={(e) => { leftW.value = e.nativeEvent.layout.width; }}
      >
        <TouchableOpacity onPress={handleDelete} className="px-5 py-4">
          <Feather name="trash-2" size={22} className="text-white" />
        </TouchableOpacity>
      </View>

      <View
        className="absolute inset-y-0 right-0 justify-center bg-warning"
        onLayout={(e) => { rightW.value = e.nativeEvent.layout.width; }}
      >
        <TouchableOpacity onPress={handleToggleFavorite} className="px-5 py-4">
          <Feather name="star" size={22} className="text-white" />
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={composed}>
        <Animated.View style={rowStyle}>
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => {
              resetSwipe();
              setEditText(item.title);
              setEditing(true);
            }}
            className="px-4 py-3 bg-bg"
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-3">
                {editing ? (
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    onBlur={handleSubmitRename}
                    onSubmitEditing={handleSubmitRename}
                    autoFocus
                    className="text-text-primary text-base font-medium mb-1 border-b border-warning pb-0.5"
                    selectTextOnFocus
                  />
                ) : (
                  <View className="flex-row items-center gap-2">
                    {item.favorite && (
                      <Feather name="star" size={14} className="text-warning" />
                    )}
                    <Text className="text-text-primary text-base font-medium mb-1 flex-1" numberOfLines={1}>
                      {item.title || 'Nouvelle conversation'}
                    </Text>
                  </View>
                )}
                <Text className="text-text-muted text-sm" numberOfLines={1}>
                  {item.preview}
                </Text>
              </View>
              <Text className="text-text-muted text-xs mt-1 shrink-0">
                {formatRelativeDate(item.date)}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
