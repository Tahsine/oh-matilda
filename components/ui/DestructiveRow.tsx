import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export function DestructiveRow({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
      <View className="flex-row items-center gap-3">
        <Feather name={icon} size={18} className="text-danger" />
        <Text className="text-danger text-base">{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
