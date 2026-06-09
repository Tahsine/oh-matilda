import React from 'react';
import { Text, View } from 'react-native';

type BadgeProps = {
  label: string;
  color: string;
};

export function Badge({ label, color }: BadgeProps) {
  return (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}20` }}>
      <Text style={{ color }} className="text-xs font-medium">
        {label}
      </Text>
    </View>
  );
}
