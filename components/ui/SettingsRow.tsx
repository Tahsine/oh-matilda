import React from 'react';
import { Text, View } from 'react-native';

export function SettingsRow({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
      <Text className="text-text-primary text-base">{label}</Text>
      {right}
    </View>
  );
}
