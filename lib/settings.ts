import { getDB } from './db';

type SettingKey = 'offline_mode' | 'reasoning' | 'memory' | 'temperature' | 'server_url' | 'provider' | 'active_model' | 'embedding_model' | 'theme' | 'api_key';

const DEFAULTS: Record<SettingKey, string> = {
  offline_mode: 'false',
  reasoning: 'false',
  memory: 'true',
  temperature: '1.0',
  server_url: '',
  provider: 'ollama-cloud',
  active_model: 'minimax-m3:cloud',
  embedding_model: 'BGE-M3 Q4_K_M (438 MB)',
  theme: 'system',
  api_key: '',
};

export function getSetting(key: SettingKey): string {
  try {
    const db = getDB();
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
    return row?.value ?? DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export function setSetting(key: SettingKey, value: string): void {
  const db = getDB();
  db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value,
  );
}

export function getBoolean(key: SettingKey): boolean {
  return getSetting(key) === 'true';
}

export function setBoolean(key: SettingKey, value: boolean): void {
  setSetting(key, value ? 'true' : 'false');
}
