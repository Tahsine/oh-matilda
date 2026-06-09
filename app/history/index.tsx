import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { SectionList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryItem } from '../../components/history/HistoryItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchBar } from '../../components/ui/SearchBar';
import {
  deleteConversation,
  getAllConversations,
  renameConversation,
  searchConversations,
  toggleFavorite,
} from '../../lib/db';
import type { Conversation } from '../../lib/types';

type Section = {
  title: string;
  data: Conversation[];
};

export default function HistoryScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    const list = search.trim()
      ? searchConversations(search.trim())
      : getAllConversations();
    setConversations(list);
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sections: Section[] = [];
  const favorites = conversations.filter((c) => c.favorite);
  const normal = conversations.filter((c) => !c.favorite);

  if (favorites.length > 0) {
    sections.push({ title: 'Favoris', data: favorites });
  }
  if (normal.length > 0) {
    sections.push({ title: 'Conversations', data: normal });
  }

  const handleDelete = (id: string) => {
    deleteConversation(id);
    load();
  };

  const handleToggleFavorite = (id: string) => {
    if (conversations.find((c) => c.id === id)) {
      toggleFavorite(id);
      load();
    }
  };

  const handleRename = (id: string, title: string) => {
    renameConversation(id, title);
    load();
  };

  const handleNew = () => {
    router.push('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Feather name="arrow-left" size={24} color="#D4D4D4" />
        </TouchableOpacity>

        <Text className="text-white text-lg font-semibold">Historique</Text>

        <TouchableOpacity onPress={handleNew} className="p-1">
          <Feather name="plus" size={22} color="#D4D4D4" />
        </TouchableOpacity>
      </View>

      <SearchBar
        placeholder="Rechercher une conversation..."
        value={search}
        onChangeText={setSearch}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryItem
            item={item}
            onPress={() => router.push({ pathname: '/', params: { id: item.id } })}
            onDelete={() => handleDelete(item.id)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
            onRename={(title) => handleRename(item.id, title)}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-4 pt-4 pb-1">
            <Text className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
              {title} ({title === 'Favoris' ? favorites.length : normal.length})
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-800 mx-4" />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        ListEmptyComponent={
          <EmptyState
            icon="message-square"
            label={search ? 'Aucun résultat' : 'Aucune conversation'}
          />
        }
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}
