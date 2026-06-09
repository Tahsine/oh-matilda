import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { Conversation, Message } from './types';

let db: SQLiteDatabase | null = null;

function getDB(): SQLiteDatabase {
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
    `);
  }
  return db;
}

type DBRowConversation = {
  id: string;
  title: string;
  preview: string;
  date: number;
  favorite: number;
};

type DBRowMessage = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: number;
};

function rowToConversation(row: DBRowConversation): Conversation {
  return {
    id: row.id,
    title: row.title,
    preview: row.preview,
    date: new Date(row.date),
    favorite: row.favorite === 1,
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
  return rows.map((r) => ({ id: r.id, role: r.role as 'user' | 'assistant', content: r.content }));
}

export function addMessage(conversationId: string, msg: Message): void {
  const db = getDB();
  db.runSync(
    'INSERT INTO messages (id, conversationId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)',
    msg.id,
    conversationId,
    msg.role,
    msg.content,
    Date.now(),
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

// --- Utils ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
