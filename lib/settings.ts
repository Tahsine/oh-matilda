import { getDB } from './db';

type SettingKey = 'offline_mode' | 'reasoning' | 'temperature' | 'server_url' | 'provider' | 'active_model' | 'embedding_model' | 'theme' | 'api_key' | 'tavily_api_key' | 'onboarded' | 'llm_n_ctx' | 'llm_n_gpu_layers' | 'llm_n_batch' | 'llm_n_ubatch' | 'llm_n_threads' | 'llm_flash_attn' | 'llm_speculative' | 'custom_prompt' | 'language';

const DEFAULTS: Record<SettingKey, string> = {
  offline_mode: 'false',
  reasoning: 'false',
  temperature: '0.6',
  server_url: '',
  provider: 'ollama-cloud',
  active_model: 'minimax-m3:cloud',
  embedding_model: 'BGE-M3 Q4_K_M (438 MB)',
  theme: 'system',
  api_key: '',
  tavily_api_key: '',
  onboarded: 'false',
  llm_n_ctx: '4096',
  llm_n_gpu_layers: '99',
  llm_n_batch: '512',
  llm_n_ubatch: '384',
  llm_n_threads: '4',
  llm_flash_attn: 'auto',
  llm_speculative: 'false',
  custom_prompt: '',
  language: '',
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
