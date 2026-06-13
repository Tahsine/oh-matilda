import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { Chunk, Conversation, FileItem, FileStatus, FileType, Message } from './types';

let db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('oh-matilda.db');
    db.execSync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        preview TEXT NOT NULL DEFAULT '',
        date INTEGER NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        conversationId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        errorMessage TEXT,
        date INTEGER NOT NULL,
        textContent TEXT NOT NULL DEFAULT '',
        localUri TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY NOT NULL,
        documentId TEXT NOT NULL,
        content TEXT NOT NULL,
        chunkIndex INTEGER NOT NULL,
        FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS chunk_embeddings (
        chunkId TEXT PRIMARY KEY NOT NULL,
        embedding TEXT NOT NULL,
        documentId TEXT NOT NULL,
        FOREIGN KEY (chunkId) REFERENCES chunks(id) ON DELETE CASCADE,
        FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    // Migration: add image column if not present
    const cols = db.getAllSync<{ name: string }>('PRAGMA table_info(messages)');
    if (!cols.some((c) => c.name === 'image')) {
      db.execSync('ALTER TABLE messages ADD COLUMN image TEXT');
    }
    // Migration: add condensed column if not present
    if (!cols.some((c) => c.name === 'condensed')) {
      db.execSync('ALTER TABLE messages ADD COLUMN condensed INTEGER NOT NULL DEFAULT 0');
    }
    const convCols = db.getAllSync<{ name: string }>('PRAGMA table_info(conversations)');
    if (!convCols.some((c) => c.name === 'summary')) {
      db.execSync('ALTER TABLE conversations ADD COLUMN summary TEXT');
    }
    if (!convCols.some((c) => c.name === 'token_usage')) {
      db.execSync('ALTER TABLE conversations ADD COLUMN token_usage INTEGER NOT NULL DEFAULT 0');
    }
  }
  return db;
}

type DBRowConversation = {
  id: string;
  title: string;
  preview: string;
  date: number;
  favorite: number;
  summary: string | null;
  token_usage: number;
};

type DBRowMessage = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: number;
  image: string | null;
  condensed: number;
};

function rowToConversation(row: DBRowConversation): Conversation {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview,
    date: new Date(row.date),
    favorite: row.favorite === 1,
    summary: row.summary ?? undefined,
    tokenUsage: row.token_usage,
  };
}

// --- Conversations ---

export function createConversation(): Conversation {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.runSync(
    'INSERT INTO conversations (id, title, preview, date, favorite) VALUES (?, ?, ?, ?, 0)',
    id,
    '',
    '',
    now,
  );
  return { id, title: '', preview: '', date: new Date(now), favorite: false };
}

export function updateConversation(
  id: string,
  fields: Partial<Pick<Conversation, 'title' | 'preview' | 'date'>>,
): void {
  const db = getDB();
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (fields.title !== undefined) {
    sets.push('title = ?');
    values.push(fields.title);
  }
  if (fields.preview !== undefined) {
    sets.push('preview = ?');
    values.push(fields.preview);
  }
  if (fields.date !== undefined) {
    sets.push('date = ?');
    values.push(fields.date.getTime());
  }

  if (sets.length === 0) return;
  values.push(id);
  db.runSync(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`, ...values);
}

export function deleteConversation(id: string): void {
  const db = getDB();
  db.runSync('DELETE FROM messages WHERE conversationId = ?', id);
  db.runSync('DELETE FROM conversations WHERE id = ?', id);
}

export function deleteAllConversations(): void {
  const db = getDB();
  db.runSync('DELETE FROM messages');
  db.runSync('DELETE FROM conversations');
}

export function toggleFavorite(id: string): boolean {
  const db = getDB();
  const row = db.getFirstSync<{ favorite: number }>(
    'SELECT favorite FROM conversations WHERE id = ?',
    id,
  );
  if (!row) return false;
  const newVal = row.favorite === 1 ? 0 : 1;
  db.runSync('UPDATE conversations SET favorite = ? WHERE id = ?', newVal, id);
  return newVal === 1;
}

export function renameConversation(id: string, title: string): void {
  const db = getDB();
  db.runSync('UPDATE conversations SET title = ? WHERE id = ?', title, id);
}

export function getAllConversations(): Conversation[] {
  const db = getDB();
  const rows = db.getAllSync<DBRowConversation>(
    'SELECT * FROM conversations ORDER BY favorite DESC, date DESC',
  );
  return rows.map(rowToConversation);
}

export function searchConversations(query: string): Conversation[] {
  const db = getDB();
  const like = `%${query}%`;
  const rows = db.getAllSync<DBRowConversation>(
    'SELECT * FROM conversations WHERE title LIKE ? OR preview LIKE ? ORDER BY favorite DESC, date DESC',
    like,
    like,
  );
  return rows.map(rowToConversation);
}

// --- Messages ---

export function getMessages(conversationId: string): Message[] {
  const db = getDB();
  const rows = db.getAllSync<DBRowMessage>(
    'SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC',
    conversationId,
  );
  return rows.map((r) => ({ id: r.id, role: r.role as 'user' | 'assistant', content: r.content, image: r.image ?? undefined, condensed: r.condensed === 1 }));
}

export function addMessage(conversationId: string, msg: Message): void {
  const db = getDB();
  db.runSync(
    'INSERT INTO messages (id, conversationId, role, content, createdAt, image) VALUES (?, ?, ?, ?, ?, ?)',
    msg.id,
    conversationId,
    msg.role,
    msg.content,
    Date.now(),
    msg.image ?? null,
  );
}

export function updateMessageContent(conversationId: string, msgId: string, content: string): void {
  const db = getDB();
  db.runSync(
    'UPDATE messages SET content = ?, createdAt = ? WHERE id = ? AND conversationId = ?',
    content,
    Date.now(),
    msgId,
    conversationId,
  );
}

export function deleteMessage(conversationId: string, msgId: string): void {
  const db = getDB();
  db.runSync('DELETE FROM messages WHERE id = ? AND conversationId = ?', msgId, conversationId);
}

export function deleteMessagesAfter(conversationId: string, afterMsgId: string): void {
  const db = getDB();
  db.runSync(
    `DELETE FROM messages WHERE conversationId = ? AND createdAt > (SELECT createdAt FROM messages WHERE id = ? AND conversationId = ?)`,
    conversationId,
    afterMsgId,
    conversationId,
  );
}

// --- Summary & Token Usage ---

export function getConversationSummary(id: string): string | null {
  const db = getDB();
  const row = db.getFirstSync<{ summary: string | null }>(
    'SELECT summary FROM conversations WHERE id = ?',
    id,
  );
  return row?.summary ?? null;
}

export function setConversationSummary(id: string, summary: string): void {
  const db = getDB();
  db.runSync('UPDATE conversations SET summary = ? WHERE id = ?', summary, id);
}

export function getTokenUsage(id: string): number {
  const db = getDB();
  const row = db.getFirstSync<{ token_usage: number }>(
    'SELECT token_usage FROM conversations WHERE id = ?',
    id,
  );
  return row?.token_usage ?? 0;
}

export function updateTokenUsage(id: string, total: number): void {
  const db = getDB();
  db.runSync('UPDATE conversations SET token_usage = ? WHERE id = ?', total, id);
}

export function markMessagesCondensed(conversationId: string, beforeMsgId: string): void {
  const db = getDB();
  db.runSync(
    `UPDATE messages SET condensed = 1 WHERE conversationId = ? AND createdAt < (SELECT createdAt FROM messages WHERE id = ? AND conversationId = ?)`,
    conversationId,
    beforeMsgId,
    conversationId,
  );
}

// --- Documents ---

type DBRowDocument = {
  id: string;
  name: string;
  type: string;
  size: number;
  status: string;
  errorMessage: string | null;
  date: number;
  textContent: string;
  localUri: string;
};

function rowToDocument(row: DBRowDocument): FileItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as FileType,
    size: row.size,
    date: new Date(row.date).toLocaleDateString('fr-FR'),
    status: row.status as FileStatus,
    localUri: row.localUri,
    errorMessage: row.errorMessage ?? undefined,
  };
}

type DBRowChunk = {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
};

export function getAllDocuments(): FileItem[] {
  const db = getDB();
  const rows = db.getAllSync<DBRowDocument>(
    'SELECT * FROM documents ORDER BY date DESC',
  );
  return rows.map(rowToDocument);
}

export function getDocumentById(id: string): FileItem | null {
  const db = getDB();
  const row = db.getFirstSync<DBRowDocument>(
    'SELECT * FROM documents WHERE id = ?',
    id,
  );
  return row ? rowToDocument(row) : null;
}

export function insertDocument(
  name: string,
  type: FileType,
  size: number,
  localUri: string,
): FileItem {
  const db = getDB();
  const id = generateId();
  const now = Date.now();
  db.runSync(
    'INSERT INTO documents (id, name, type, size, status, date, textContent, localUri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    name,
    type,
    size,
    'pending',
    now,
    '',
    localUri,
  );
  return {
    id,
    name,
    type,
    size,
    status: 'pending',
    date: new Date(now).toLocaleDateString('fr-FR'),
    localUri,
  };
}

export function updateDocumentStatus(
  id: string,
  status: FileStatus,
  textContent?: string,
  errorMessage?: string,
): void {
  const db = getDB();
  if (textContent !== undefined && errorMessage !== undefined) {
    db.runSync(
      'UPDATE documents SET status = ?, textContent = ?, errorMessage = ? WHERE id = ?',
      status,
      textContent,
      errorMessage,
      id,
    );
  } else if (textContent !== undefined) {
    db.runSync(
      'UPDATE documents SET status = ?, textContent = ? WHERE id = ?',
      status,
      textContent,
      id,
    );
  } else if (errorMessage !== undefined) {
    db.runSync(
      'UPDATE documents SET status = ?, errorMessage = ? WHERE id = ?',
      status,
      errorMessage,
      id,
    );
  } else {
    db.runSync('UPDATE documents SET status = ? WHERE id = ?', status, id);
  }
}

export function deleteDocument(id: string): void {
  const db = getDB();
  db.runSync('DELETE FROM chunk_embeddings WHERE documentId = ?', id);
  db.runSync('DELETE FROM chunks WHERE documentId = ?', id);
  db.runSync('DELETE FROM documents WHERE id = ?', id);
}

export function searchDocumentText(query: string): {
  documentId: string;
  documentName: string;
  snippet: string;
}[] {
  const db = getDB();
  const like = `%${query}%`;
  const rows = db.getAllSync<{ id: string; name: string; textContent: string }>(
    "SELECT id, name, textContent FROM documents WHERE textContent LIKE ? AND textContent != ''",
    like,
  );
  return rows.map((r) => ({
    documentId: r.id,
    documentName: r.name,
    snippet: extractSnippet(r.textContent, query, 200),
  }));
}

// --- Chunks ---

export function insertChunks(documentId: string, chunks: string[]): Chunk[] {
  const db = getDB();
  const result: Chunk[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const id = generateId();
    db.runSync(
      'INSERT INTO chunks (id, documentId, content, chunkIndex) VALUES (?, ?, ?, ?)',
      id,
      documentId,
      chunks[i],
      i,
    );
    result.push({ id, documentId, content: chunks[i], chunkIndex: i });
  }
  return result;
}

export function getChunks(documentId: string): Chunk[] {
  const db = getDB();
  return db.getAllSync<DBRowChunk>(
    'SELECT * FROM chunks WHERE documentId = ? ORDER BY chunkIndex ASC',
    documentId,
  );
}

// --- Chunk Embeddings ---

type DBRowChunkEmbedding = {
  chunkId: string;
  embedding: string;
  documentId: string;
};

type DBRowEmbeddingWithContent = DBRowChunkEmbedding & {
  content: string;
  documentName: string;
};

export function getEmbeddingsWithContent(): DBRowEmbeddingWithContent[] {
  const db = getDB();
  return db.getAllSync<DBRowEmbeddingWithContent>(
    `SELECT ce.chunkId, ce.embedding, ce.documentId, c.content, d.name AS documentName
     FROM chunk_embeddings ce
     JOIN chunks c ON c.id = ce.chunkId
     JOIN documents d ON d.id = ce.documentId`,
  );
}

export function insertChunkEmbedding(
  chunkId: string,
  embedding: number[],
  documentId: string,
): void {
  const db = getDB();
  db.runSync(
    'INSERT OR REPLACE INTO chunk_embeddings (chunkId, embedding, documentId) VALUES (?, ?, ?)',
    chunkId,
    JSON.stringify(embedding),
    documentId,
  );
}

// --- Utils ---

function extractSnippet(text: string, query: string, contextChars: number): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, contextChars);

  const start = Math.max(0, idx - contextChars / 2);
  const end = Math.min(text.length, idx + query.length + contextChars / 2);
  let snippet = text.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
