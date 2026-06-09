import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export function DestructiveRow({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <TouchableOpacity className="flex-row items-center justify-between px-4 py-3.5 bg-[#2A2A2A]">
      <View className="flex-row items-center gap-3">
        <Feather name={icon} size={18} color="#EF4444" />
        <Text className="text-red-500 text-base">{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
