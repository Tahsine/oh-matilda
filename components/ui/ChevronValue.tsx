import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

type ChevronValueProps = {
  value: string;
};

export function ChevronValue({ value }: ChevronValueProps) {
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-neutral-400 text-base">{value}</Text>
      <Feather name="chevron-right" size={18} color="#737373" />
    </View>
  );
}
