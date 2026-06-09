import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FileStatus = 'indexed' | 'pending' | 'error';
type FileType = 'pdf' | 'docx';

type FileItem = {
  id: string;
  name: string;
  type: FileType;
  size: string;
  date: string;
  status: FileStatus;
};

const MOCK_FILES: FileItem[] = [
  { id: '1', name: 'Rapport annuel 2025.pdf', type: 'pdf', size: '2.4 MB', date: '15/05/2025', status: 'indexed' },
  { id: '2', name: 'Contrat client Martin.docx', type: 'docx', size: '156 KB', date: '12/05/2025', status: 'indexed' },
  { id: '3', name: 'Spécifications techniques v3.pdf', type: 'pdf', size: '8.1 MB', date: '10/05/2025', status: 'pending' },
  { id: '4', name: 'Note de réunion équipe.docx', type: 'docx', size: '89 KB', date: '08/05/2025', status: 'error' },
  { id: '5', name: 'Guide utilisateur Matilda.pdf', type: 'pdf', size: '1.2 MB', date: '05/05/2025', status: 'indexed' },
  { id: '6', name: 'Proposition commerciale.docx', type: 'docx', size: '420 KB', date: '02/05/2025', status: 'pending' },
];

const FILTERS = ['Tous', 'PDF', 'Word', 'Indexés', 'En attente'];

const STATUS_LABEL: Record<FileStatus, string> = {
  indexed: 'Indexé',
  pending: 'En cours',
  error: 'Erreur',
};

const STATUS_COLOR: Record<FileStatus, string> = {
  indexed: '#22C55E',
  pending: '#F97316',
  error: '#EF4444',
};

const FILE_ICON: Record<FileType, keyof typeof Feather.glyphMap> = {
  pdf: 'file-text',
  docx: 'file',
};

export default function FilesScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('Tous');

  const filtered =
    activeFilter === 'Tous'
      ? MOCK_FILES
      : MOCK_FILES.filter(f => {
          if (activeFilter === 'PDF') return f.type === 'pdf';
          if (activeFilter === 'Word') return f.type === 'docx';
          if (activeFilter === 'Indexés') return f.status === 'indexed';
          if (activeFilter === 'En attente') return f.status === 'pending' || f.status === 'error';
          return true;
        });

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Feather name="arrow-left" size={24} color="#D4D4D4" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-white text-lg font-semibold">Fichiers</Text>
        <TouchableOpacity>
          <Feather name="upload" size={22} color="#D4D4D4" />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-2 px-4"
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {FILTERS.map(f => {
          const active = f === activeFilter;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              className={`h-8 items-center justify-center px-4 rounded-full ${active ? 'bg-white' : 'bg-[#2A2A2A]'}`}
            >
              <Text className={`text-sm ${active ? 'text-black font-medium' : 'text-neutral-400'}`}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* File list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity className="flex-row items-center py-4 border-b border-neutral-800/60">
            <View className="w-10 h-10 rounded-lg bg-[#2A2A2A] items-center justify-center mr-3">
              <Feather name={FILE_ICON[item.type]} size={20} color={STATUS_COLOR[item.status]} />
            </View>

            <View className="flex-1 mr-3">
              <Text className="text-white text-sm font-medium" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-neutral-500 text-xs mt-0.5">
                {item.size} · {item.date}
              </Text>
            </View>

            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${STATUS_COLOR[item.status]}20` }}
            >
              <Text style={{ color: STATUS_COLOR[item.status] }} className="text-xs font-medium">
                {STATUS_LABEL[item.status]}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Feather name="inbox" size={48} color="#525252" />
            <Text className="text-neutral-500 text-base mt-4">Aucun fichier trouvé</Text>
          </View>
        }
      />


    </SafeAreaView>
  );
}
