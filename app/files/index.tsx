import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import { Alert, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileListItem } from '../../components/files/FileListItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChips } from '../../components/ui/FilterChips';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SearchBar } from '../../components/ui/SearchBar';
import { chunkText } from '../../lib/chunker';
import {
  deleteDocument,
  getAllDocuments,
  insertChunks,
  insertDocument,
  updateDocumentStatus,
} from '../../lib/db';
import { parseDocument } from '../../lib/document-parser';
import { generateEmbeddings } from '../../lib/embeddings';
import { pushError } from '../../lib/error-handler';
import { logger } from '../../lib/logger';
import { storeEmbeddings } from '../../lib/vector-store';
import type { FileItem } from '../../lib/types';
import { useTokens } from '../../lib/theme-tokens';

const FILTERS = ['Tous', 'PDF', 'Word', 'Indexés', 'En attente'];

export default function FilesScreen() {
  const [documents, setDocuments] = useState<FileItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('Tous');
  const [search, setSearch] = useState('');
  const indexingIds = useRef<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [, forceRender] = useState(0);
  const t = useTokens();

  const rerender = useCallback(() => forceRender(n => n + 1), []);

  const loadDocuments = useCallback(() => {
    setDocuments(getAllDocuments());
  }, []);

  useFocusEffect(useCallback(() => { loadDocuments(); }, [loadDocuments]));

  const indexDocumentFile = useCallback(async (id: string, name: string, localUri: string) => {
    indexingIds.current = new Set(indexingIds.current).add(id);
    rerender();
    updateDocumentStatus(id, 'indexing');
    logger.index('start', { id, name });

    const isPDF = name.toLowerCase().endsWith('.pdf');
    let parsed;

    try {
      if (isPDF) {
        logger.file('extract PDF', localUri);
        parsed = await parseDocument(name, localUri);
      } else {
        logger.file('fetch', localUri);
        const response = await fetch(localUri);
        const buffer = await response.arrayBuffer();
        logger.file('fetched', { bytes: buffer.byteLength });
        parsed = await parseDocument(name, buffer);
      }

      if (parsed.success) {
        logger.index('parse OK', { chars: parsed.text.length });
        const chunksText = chunkText(parsed.text);
        logger.index('chunked', { chunks: chunksText.length });
        const chunks = insertChunks(id, chunksText);
        logger.index('chunks stored', { count: chunks.length });

        try {
          const embeddings = await generateEmbeddings(chunksText);
          storeEmbeddings(chunks, embeddings);
          logger.index('embeddings OK', { count: embeddings.length });
        } catch (e) {
          logger.index('embeddings FAILED (non-fatal)', e);
          pushError({ type: 'embedding', message: `Indexation partielle de "${name}" : échec des embeddings` });
        }

        updateDocumentStatus(id, 'indexed', parsed.text);
        logger.index('done', { status: 'indexed' });
      } else {
        logger.index('parse FAILED', parsed.error);
        pushError({ type: 'parse', message: `Impossible de lire "${name}" : ${parsed.error}` });
        updateDocumentStatus(id, 'error', undefined, parsed.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      logger.index('exception', msg);
      pushError({ type: 'parse', message: `Erreur lors de l'indexation de "${name}" : ${msg}` });
      updateDocumentStatus(id, 'error', undefined, msg);
    } finally {
      indexingIds.current = new Set(indexingIds.current);
      indexingIds.current.delete(id);
      rerender();
      loadDocuments();
    }
  }, [loadDocuments, rerender]);

  const handleOpenFile = useCallback(async (uri: string) => {
    await Sharing.shareAsync(uri, { dialogTitle: 'Ouvrir avec' });
  }, []);

  const handlePick = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets?.length) return;
    for (const file of result.assets) {
      const fileType: 'pdf' | 'docx' = file.mimeType?.includes('pdf')
        ? 'pdf'
        : file.name.toLowerCase().endsWith('.pdf')
          ? 'pdf'
          : 'docx';

      const doc = insertDocument(file.name, fileType, file.size || 0, file.uri);
      loadDocuments();
      indexDocumentFile(doc.id, doc.name, doc.localUri);
    }
  }, [loadDocuments, indexDocumentFile]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      'Supprimer le fichier',
      `Supprimer "${name}" et toutes ses données indexées ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => { deleteDocument(id); loadDocuments(); } },
      ],
    );
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

  const filtered = documents.filter(f => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!f.name.toLowerCase().includes(q)) return false;
    }
    if (activeFilter === 'Tous') return true;
    if (activeFilter === 'PDF') return f.type === 'pdf';
    if (activeFilter === 'Word') return f.type === 'docx';
    if (activeFilter === 'Indexés') return f.status === 'indexed';
    if (activeFilter === 'En attente') return f.status === 'pending' || f.status === 'indexing' || f.status === 'error';
    return true;
  });

  const isLoading = indexingIds.current.size > 0;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScreenHeader
        title="Fichiers"
        rightAction={
          <TouchableOpacity onPress={handlePick} className="p-1" disabled={isLoading}>
            <Feather name="plus" size={24} color={isLoading ? t.textSubtle : t.icon} />
          </TouchableOpacity>
        }
      />

      <SearchBar
        placeholder="Rechercher un fichier..."
        value={search}
        onChangeText={setSearch}
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
            colors={['#64748B']}
          />
        }
        renderItem={({ item }) => (
          <FileListItem
            item={item}
            onPress={() => handleOpenFile(item.localUri)}
            onDelete={() => handleDelete(item.id, item.name)}
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
