import { Feather } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { useTokens } from '../../lib/theme-tokens';

type SearchBarProps = {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
};

export function SearchBar({ placeholder, value, onChangeText }: SearchBarProps) {
  const { t: tr } = useTranslation();
  const resolvedPlaceholder = placeholder ?? tr('common.search');
  const t = useTokens();
  return (
    <View className="mx-4 mt-3 mb-2">
      <View className="flex-row items-center bg-input rounded-xl border border-border px-3 py-2.5">
        <Feather name="search" size={18} color={t.inputPlaceholder} />
        <TextInput
          placeholder={resolvedPlaceholder}
          placeholderTextColor={t.inputPlaceholder}
          className="flex-1 text-text-primary text-base ml-2"
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}
