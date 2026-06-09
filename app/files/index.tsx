import React, { useState } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileListItem } from '../../components/files/FileListItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChips } from '../../components/ui/FilterChips';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import type { FileItem } from '../../lib/types';

const MOCK_FILES: FileItem[] = [
  { id: '1', name: 'Rapport annuel 2025.pdf', type: 'pdf', size: '2.4 MB', date: '15/05/2025', status: 'indexed' },
  { id: '2', name: 'Contrat client Martin.docx', type: 'docx', size: '156 KB', date: '12/05/2025', status: 'indexed' },
  { id: '3', name: 'Spécifications techniques v3.pdf', type: 'pdf', size: '8.1 MB', date: '10/05/2025', status: 'pending' },
  { id: '4', name: 'Note de réunion équipe.docx', type: 'docx', size: '89 KB', date: '08/05/2025', status: 'error' },
  { id: '5', name: 'Guide utilisateur Matilda.pdf', type: 'pdf', size: '1.2 MB', date: '05/05/2025', status: 'indexed' },
  { id: '6', name: 'Proposition commerciale.docx', type: 'docx', size: '420 KB', date: '02/05/2025', status: 'pending' },
];

const FILTERS = ['Tous', 'PDF', 'Word', 'Indexés', 'En attente'];

export default function FilesScreen() {
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
      <ScreenHeader title="Fichiers" />

      <FilterChips filters={FILTERS} active={activeFilter} onSelect={setActiveFilter} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => <FileListItem item={item} />}
        ListEmptyComponent={<EmptyState icon="inbox" label="Aucun fichier trouvé" />}
      />
    </SafeAreaView>
  );
}
