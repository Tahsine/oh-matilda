import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryItem } from '../../components/history/HistoryItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchBar } from '../../components/ui/SearchBar';
import type { Conversation } from '../../lib/types';

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    title: 'Analyse du contrat de location',
    preview: "Voici le résumé des clauses principales que j'ai identifiées dans le document PDF...",
    date: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: '2',
    title: "Rédaction d'un email professionnel",
    preview: 'Je peux vous aider à rédiger un email formel pour votre situation. Voici un exemple...',
    date: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: '3',
    title: 'Extraction des données du rapport financier',
    preview: "J'ai extrait les chiffres clés du document Word. Le chiffre d'affaires est de...",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: '4',
    title: 'Comparaison de devis',
    preview: "Après analyse des deux devis, voici les différences principales que j'ai trouvées...",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: '5',
    title: 'Synthèse du procès-verbal',
    preview: 'Le PV de réunion du 15 mai contient 3 décisions majeures concernant le budget...',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
];

export default function HistoryScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Feather name="arrow-left" size={24} color="#D4D4D4" />
        </TouchableOpacity>

        <Text className="text-white text-lg font-semibold">Historique</Text>

        <TouchableOpacity className="p-1">
          <Feather name="trash-2" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <SearchBar />

      <FlatList
        data={MOCK_CONVERSATIONS}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <HistoryItem item={item} onPress={() => router.push({ pathname: '/', params: { id: item.id } })} />
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-800 mx-4" />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        ListEmptyComponent={<EmptyState icon="message-square" label="Aucune conversation" />}
      />
    </SafeAreaView>
  );
}
