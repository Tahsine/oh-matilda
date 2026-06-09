import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Conversation = {
  id: string;
  title: string;
  preview: string;
  date: Date;
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    title: 'Analyse du contrat de location',
    preview: 'Voici le résumé des clauses principales que j\'ai identifiées dans le document PDF...',
    date: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: '2',
    title: 'Rédaction d\'un email professionnel',
    preview: 'Je peux vous aider à rédiger un email formel pour votre situation. Voici un exemple...',
    date: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: '3',
    title: 'Extraction des données du rapport financier',
    preview: 'J\'ai extrait les chiffres clés du document Word. Le chiffre d\'affaires est de...',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: '4',
    title: 'Comparaison de devis',
    preview: 'Après analyse des deux devis, voici les différences principales que j\'ai trouvées...',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: '5',
    title: 'Synthèse du procès-verbal',
    preview: 'Le PV de réunion du 15 mai contient 3 décisions majeures concernant le budget...',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  },
];

function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function HistoryScreen() {
  const router = useRouter();

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/', params: { id: item.id } })}
      className="px-4 py-3"
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-white text-base font-medium mb-1" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-neutral-500 text-sm" numberOfLines={1}>
            {item.preview}
          </Text>
        </View>
        <Text className="text-neutral-500 text-xs mt-1 shrink-0">
          {formatRelativeDate(item.date)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      {/* --- HEADER --- */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Feather name="arrow-left" size={24} color="#D4D4D4" />
        </TouchableOpacity>

        <Text className="text-white text-lg font-semibold">Historique</Text>

        <TouchableOpacity className="p-1">
          <Feather name="trash-2" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* --- SEARCH BAR --- */}
      <View className="mx-4 mt-3 mb-2">
        <View className="flex-row items-center bg-[#2A2A2A] rounded-xl px-3 py-2.5">
          <Feather name="search" size={18} color="#A3A3A3" />
          <TextInput
            placeholder="Rechercher..."
            placeholderTextColor="#A3A3A3"
            className="flex-1 text-white text-base ml-2"
          />
        </View>
      </View>

      {/* --- LIST --- */}
      <FlatList
        data={MOCK_CONVERSATIONS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-800 mx-4" />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-4">
            <Feather name="message-square" size={48} color="#525252" />
            <Text className="text-neutral-500 text-base mt-4">Aucune conversation</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
