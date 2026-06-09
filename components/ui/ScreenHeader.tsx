import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type ScreenHeaderProps = {
  title: string;
  rightAction?: React.ReactNode;
};

export function ScreenHeader({ title, rightAction }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-neutral-800">
      <TouchableOpacity onPress={() => router.back()} className="mr-3">
        <Feather name="arrow-left" size={24} color="#D4D4D4" />
      </TouchableOpacity>
      <Text className="flex-1 text-center text-white text-lg font-semibold">{title}</Text>
      {rightAction ? (
        rightAction
      ) : (
        <View className="w-7" />
      )}
    </View>
  );
}
