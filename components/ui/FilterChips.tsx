import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';

type FilterChipsProps = {
  filters: string[];
  active: string;
  onSelect: (filter: string) => void;
};

export function FilterChips({ filters, active, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="py-2 px-4"
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8 }}
    >
      {filters.map(f => {
        const isActive = f === active;
        return (
          <TouchableOpacity
            key={f}
            onPress={() => onSelect(f)}
            className={`h-8 items-center justify-center px-4 rounded-full ${isActive ? 'bg-primary' : 'bg-surface'}`}
          >
            <Text className={`text-sm ${isActive ? 'text-white font-medium' : 'text-text-secondary'}`}>
              {f}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
