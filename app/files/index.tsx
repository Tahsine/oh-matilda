import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileListItem } from '../../components/files/FileListItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChips } from '../../components/ui/FilterChips';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { chunkText } from '../../lib/chunker';
import {
  deleteDocument,
  getAllDocuments,
  getDocumentById,
  insertChunks,
  insertDocument,
  updateDocumentStatus,
} from '../../lib/db';
import { parseDocument } from '../../lib/document-parser';
import type { FileItem } from '../../lib/types';

const FILTERS = ['Tous', 'PDF', 'Word', 'Indexés', 'En attente'];

export default function FilesScreen() {
  const [documents, setDocuments] = useState<FileItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('Tous');
  const indexingIds = useRef<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [, forceRender] = useState(0);

  const rerender = useCallback(() => forceRender(n => n + 1), []);

  const loadDocuments = useCallback(() => {
    setDocuments(getAllDocuments());
  }, []);

  useFocusEffect(useCallback(() => { loadDocuments(); }, [loadDocuments]));

  const indexDocumentFile = useCallback(async (id: string, name: string, localUri: string) => {
    indexingIds.current = new Set(indexingIds.current).add(id);
    rerender();
    updateDocumentStatus(id, 'indexing');

    try {
      const response = await fetch(localUri);
      const buffer = await response.arrayBuffer();
      const parsed = await parseDocument(name, buffer);

      if (parsed.success) {
        const chunks = chunkText(parsed.text);
        updateDocumentStatus(id, 'indexed', parsed.text);
        insertChunks(id, chunks);
      } else {
        updateDocumentStatus(id, 'error', undefined, parsed.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      updateDocumentStatus(id, 'error', undefined, msg);
    } finally {
      indexingIds.current = new Set(indexingIds.current);
      indexingIds.current.delete(id);
      rerender();
      loadDocuments();
    }
  }, [loadDocuments, rerender]);

  const handlePick = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];

    const fileType: 'pdf' | 'docx' = file.mimeType?.includes('pdf')
      ? 'pdf'
      : file.name.toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'docx';

    const doc = insertDocument(file.name, fileType, file.size || 0, file.uri);
    loadDocuments();
    indexDocumentFile(doc.id, doc.name, doc.localUri);
  }, [loadDocuments, indexDocumentFile]);

  const handleDelete = useCallback((id: string) => {
    deleteDocument(id);
    loadDocuments();
  }, [loadDocuments]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const all = getAllDocuments();
    const toRetry = all.filter(d => d.status === 'error' || d.status === 'pending');

    for (const doc of toRetry) {
      await indexDocumentFile(doc.id, doc.name, doc.localUri);
    }

    loadDocuments();
    setRefreshing(false);
  }, [indexDocumentFile, loadDocuments]);

  const filtered =
    activeFilter === 'Tous'
      ? documents
      : documents.filter(f => {
          if (activeFilter === 'PDF') return f.type === 'pdf';
          if (activeFilter === 'Word') return f.type === 'docx';
          if (activeFilter === 'Indexés') return f.status === 'indexed';
          if (activeFilter === 'En attente') return f.status === 'pending' || f.status === 'indexing' || f.status === 'error';
          return true;
        });

  const isLoading = indexingIds.current.size > 0;

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      <ScreenHeader
        title="Fichiers"
        rightAction={
          <TouchableOpacity onPress={handlePick} className="p-1" disabled={isLoading}>
            <Feather name="plus" size={24} color={isLoading ? '#666' : '#D4D4D4'} />
          </TouchableOpacity>
        }
      />

      <FilterChips filters={FILTERS} active={activeFilter} onSelect={setActiveFilter} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D4D4D4"
            colors={['#22C55E']}
          />
        }
        renderItem={({ item }) => (
          <FileListItem
            item={item}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="inbox"
            label="Aucun fichier trouvé"
            description="Ajoutez un PDF ou un document Word avec le bouton +"
          />
        }
      />
    </SafeAreaView>
  );
}
