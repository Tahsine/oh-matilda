import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { useTokens } from '../../lib/theme-tokens';

type EmptyStateProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description?: string;
};

export function EmptyState({ icon, label, description }: EmptyStateProps) {
  const t = useTokens();
  return (
    <View className="flex-1 items-center justify-center px-4 pt-20">
      <Feather name={icon} size={48} color={t.textMuted} />
      <Text className="text-text-muted text-base mt-4">{label}</Text>
      {description && (
        <Text className="text-text-muted text-sm mt-2 text-center">{description}</Text>
      )}
    </View>
  );
}
