// Clé API Ollama : store app-privé (plugin-store Tauri) d'abord, clé Rust
// compilée (option_env!) en repli. Fini les rebuilds pour changer de clé.
// Note : non chiffré (sandbox app Android sur téléphone non-rooté).
// Stronghold abandonné : load() pend sur ce device (cf. historique).
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";

const RECORD_KEY = "ollama_api_key";

let storePromise: Promise<LazyStore> | null = null;

function lazyStore(): Promise<LazyStore> {
  if (!storePromise) {
    storePromise = (async () => new LazyStore("settings.json"))();
  }
  return storePromise;
}

function decode(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Clé effective : device d'abord, compilée sinon. Vide si aucune. */
export async function getOllamaKey(): Promise<string> {
  try {
    const store = await lazyStore();
    const v = decode(await store.get<string>(RECORD_KEY));
    if (v) return v;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[ollamakey] store get failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const v = await invoke<string>("get_ollama_key");
    if (v && v.trim()) return v.trim();
  } catch {
    // ignore
  }
  return "";
}

export async function getKeyStatus(): Promise<boolean> {
  return (await getOllamaKey()).length > 0;
}

/** 4 derniers caractères (affichage statut uniquement, jamais loggés). */
export async function getKeySuffix(): Promise<string> {
  const k = await getOllamaKey();
  return k.length <= 4 ? "" : k.slice(-4);
}

export async function saveApiKey(key: string): Promise<void> {
  const store = await lazyStore();
  await store.set(RECORD_KEY, key.trim());
  await store.save();
}

export async function clearApiKey(): Promise<void> {
  const store = await lazyStore();
  await store.delete(RECORD_KEY);
  await store.save();
}

/** Erreur LLM brute → message compréhensible (agent + chat). Générique.
 * Ne touche que les erreurs transport/auth reconnues, le reste passe tel quel. */
export function friendlyLlmError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.match(/LLM http (\d{3})/);
  const code = m ? m[1] : "";
  if (/missing.*key|OLLAMA_API_KEY|no api key|clé.*manquante/i.test(raw)) {
    return "Clé API manquante — ajoute-la dans Réglages";
  }
  if (code === "401" || code === "403" || /unauthorized|unauthenticated/i.test(raw)) {
    return "Clé API refusée — vérifie-la dans Réglages";
  }
  if (code === "429" || /too many|rate limit|quota/i.test(raw)) {
    return "Quota dépassé, réessaie plus tard";
  }
  if (/timeout|timed out|network|fetch failed|connection|abort|econn|enotfound|socket/i.test(raw)) {
    return "Réseau indisponible, réessaie";
  }
  return raw;
}

/** Test direct : 1 mini appel /api/chat (SEUL endpoint qui vérifie l'auth).
 * num_predict:1 = rejet 401 avant génération si mauvaise clé (0 quota).
 * Timeout 25 s. */
export async function testApiKey(explicit?: string): Promise<boolean> {
  const typed = explicit?.trim() || "";
  const key = typed || (await getOllamaKey());
  if (!key) return false;
  try {
    const { fetch } = await import("@tauri-apps/plugin-http");
    const resp = (await Promise.race([
      fetch("https://ollama.com/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gemma4:31b",
          messages: [{ role: "user", content: "hi" }],
          stream: false,
          options: { num_predict: 1 },
        }),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("test timeout")), 25000);
      }),
    ])) as { ok: boolean };
    return resp.ok;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[ollamakey] test failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
