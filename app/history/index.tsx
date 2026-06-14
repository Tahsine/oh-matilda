import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, RefreshControl, SectionList, Text, TouchableOpacity, View } from 'react-native';
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
import { useTokens } from '../../lib/theme-tokens';

type Section = {
  title: string;
  data: Conversation[];
};

export default function HistoryScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTokens();

  const load = useCallback((query?: string) => {
    const q = query?.trim();
    const list = q ? searchConversations(q) : getAllConversations();
    setConversations(list);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(search), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search, load]);

  useFocusEffect(
    useCallback(() => {
      load(search);
    }, [load, search]),
  );

  const sections: Section[] = [];
  const favorites = conversations.filter((c) => c.favorite);
  const normal = conversations.filter((c) => !c.favorite);

  if (favorites.length > 0) {
    sections.push({ title: tr('history.favorites'), data: favorites });
  }
  if (normal.length > 0) {
    sections.push({ title: tr('history.conversations'), data: normal });
  }

  const handleDelete = (id: string) => {
    Alert.alert(
      tr('history.deleteTitle'),
      tr('history.deleteMessage'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.delete'), style: 'destructive', onPress: () => { deleteConversation(id); load(search); } },
      ],
    );
  };

  const handleToggleFavorite = (id: string) => {
    if (conversations.find((c) => c.id === id)) {
      toggleFavorite(id);
      load(search);
    }
  };

  const handleRename = (id: string, title: string) => {
    renameConversation(id, title);
    load(search);
  };

  const handleNew = () => {
    router.push('/');
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    requestAnimationFrame(() => {
      load(search);
      setRefreshing(false);
    });
  }, [load, search]);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Feather name="arrow-left" size={24} color={t.icon} />
        </TouchableOpacity>

        <Text className="text-text-primary text-lg font-semibold">{tr('history.title')}</Text>

        <TouchableOpacity onPress={handleNew} className="p-1">
          <Feather name="plus" size={22} color={t.icon} />
        </TouchableOpacity>
      </View>

      <SearchBar
        placeholder={tr('history.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D4D4D4"
          />
        }
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
            <Text className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              {title} ({title === tr('history.favorites') ? favorites.length : normal.length})
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-border mx-4" />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        ListEmptyComponent={
          <EmptyState
            icon="message-square"
            label={search ? tr('history.emptyResults') : tr('history.emptyConversations')}
          />
        }
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}
