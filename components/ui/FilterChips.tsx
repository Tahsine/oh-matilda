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
            className={`h-8 items-center justify-center px-4 rounded-full ${isActive ? 'bg-white' : 'bg-[#2A2A2A]'}`}
          >
            <Text className={`text-sm ${isActive ? 'text-black font-medium' : 'text-neutral-400'}`}>
              {f}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
