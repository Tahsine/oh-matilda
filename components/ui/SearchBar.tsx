import { Feather } from '@expo/vector-icons';
import React from 'react';
import { TextInput, View } from 'react-native';

type SearchBarProps = {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
};

export function SearchBar({ placeholder = 'Rechercher...', value, onChangeText }: SearchBarProps) {
  return (
    <View className="mx-4 mt-3 mb-2">
      <View className="flex-row items-center bg-input rounded-xl px-3 py-2.5">
        <Feather name="search" size={18} className="text-input-placeholder" />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="var(--color-input-placeholder)"
          className="flex-1 text-text-primary text-base ml-2"
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}
