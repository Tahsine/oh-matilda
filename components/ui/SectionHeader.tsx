import React from 'react';
import { Text } from 'react-native';

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-text-muted text-xs font-semibold tracking-wider uppercase px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}
