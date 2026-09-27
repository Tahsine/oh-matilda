// Agent réel — Ollama Cloud `gpt-oss:20b-cloud` via Vercel AI SDK.
// Phase 6 : chat seul (pas d'exécution native). Remplace `mockAgent`
// (supprimé) : même contrat de streaming, tokens réels au lieu du
// `setInterval` simulé. Clé lue côté Rust (`get_ollama_key`).
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { streamText } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import type { AttachmentState, ChatMessage, Mode } from "@/types";

export const OLLAMA_MODEL = "gpt-oss:20b";
// Le provider ajoute `/api/chat` lui-même ; le fetch passe par le backend
// Rust (`tauri-plugin-http`) pour éviter le CORS de la WebView.
export const OLLAMA_BASE_URL = "https://ollama.com/api";

const HISTORY_LIMIT = 10;

export const FAST_SYSTEM =
  "You are Oh-Matilda, a helpful mobile AI assistant. Answer directly and concisely, phone-screen friendly. " +
  "Use **bold** for key terms. If the user asks you to act on the phone, describe what you would do and ask for " +
  "confirmation before acting. Never invent actions you did not perform.";

export const THINKING_SYSTEM =
  "You are Oh-Matilda, a helpful mobile AI assistant. Reason step by step before answering: goal, known facts, " +
  "smallest next step. Then give a clear structured answer, phone-screen friendly, **bold** key terms. " +
  "If the user asks you to act on the phone, plan the steps explicitly and ask for confirmation before acting. " +
  "Never invent actions you did not perform.";

export function systemFor(mode: Mode): string {
  return mode === "thinking" ? THINKING_SYSTEM : FAST_SYSTEM;
}

function stripMarkup(raw: string): string {
  return raw
    .replace(/\[\[cite:\d+\]\]/g, "")
    .replace(/\*\*|==/g, "");
}

function toLlmMessages(history: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    const content = stripMarkup(m.sender === "user" ? m.text ?? "" : m.rawText ?? "").trim();
    if (!content) continue;
    out.push({ role: m.sender === "user" ? "user" : "assistant", content });
  }
  return out.slice(-HISTORY_LIMIT);
}

export interface OllamaStreamOptions {
  prompt: string;
  mode: Mode;
  history: ChatMessage[];
  attachments: AttachmentState;
  onToken: (buffer: string) => void;
  onThinking: (thinking: string) => void;
  onDone: (finalText: string, thinking: string) => void;
  onError: (message: string) => void;
}

export interface OllamaStreamHandle {
  cancel: () => void;
}

export function streamOllamaResponse(opts: OllamaStreamOptions): OllamaStreamHandle {
  const abort = new AbortController();
  let cancelled = false;

  const cancel = (): void => {
    cancelled = true;
    try {
      abort.abort();
    } catch {
      // ignore
    }
  };

  void (async () => {
    let key: string;
    try {
      key = await invoke<string>("get_ollama_key");
    } catch (e) {
      if (!cancelled) opts.onError(e instanceof Error ? e.message : String(e));
      return;
    }

    const provider = createOllama({
      baseURL: OLLAMA_BASE_URL,
      headers: { Authorization: `Bearer ${key}` },
      fetch: tauriFetch as typeof fetch,
    });

    const attachmentNote =
      opts.attachments.photo || opts.attachments.file
        ? "[The user attached a photo/file alongside their message — acknowledge it briefly.] "
        : "";
    const content = `${attachmentNote}${opts.prompt}` || "Hello";

    let result: Awaited<ReturnType<typeof streamText>>;
    try {
      result = await streamText({
        model: provider(OLLAMA_MODEL as never),
        system: systemFor(opts.mode),
        messages: [...toLlmMessages(opts.history), { role: "user", content }],
        providerOptions: { ollama: { think: opts.mode === "thinking" } },
        abortSignal: abort.signal,
      });
    } catch (e) {
      if (!cancelled && !abort.signal.aborted) {
        opts.onError(e instanceof Error ? e.message : String(e));
      }
      return;
    }

    let buffer = "";
    let thinking = "";
    const partCounts: Record<string, number> = {};
    try {
      for await (const part of result.fullStream) {
        if (abort.signal.aborted || cancelled) return;
        const p = part as unknown as Record<string, unknown>;
        const t = (p["type"] ?? "unknown") as string;
        partCounts[t] = (partCounts[t] ?? 0) + 1;
        if (t === "error") {
          // eslint-disable-next-line no-console
          console.log(`[ollama] error-part=${JSON.stringify(p).slice(0, 500)}`);
        }
        if (p["type"] === "text-delta") {
          const d = (p["text"] ?? p["delta"] ?? "") as string;
          if (d) {
            buffer += d;
            opts.onToken(buffer);
          }
        } else if (p["type"] === "reasoning-delta" || p["type"] === "reasoning") {
          const d = (p["text"] ?? p["delta"] ?? "") as string;
          if (d) {
            thinking += d;
            opts.onThinking(thinking);
          }
        }
      }
    } catch (e) {
      if (!cancelled && !abort.signal.aborted) {
        opts.onError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    if (cancelled || abort.signal.aborted) return;
    // Source finale fiable : les agrégats du résultat (au cas où un
    // format de delta ne serait pas reconnu ci-dessus).
    try {
      const fullText = await result.text;
      if (fullText && !buffer) {
        buffer = fullText;
        opts.onToken(buffer);
      } else if (fullText) {
        buffer = fullText;
      }
      const reasoning = (await result.reasoning) as unknown as Array<Record<string, unknown>>;
      if (Array.isArray(reasoning) && reasoning.length > 0 && !thinking) {
        thinking = reasoning
          .map((r) => (r["text"] ?? "") as string)
          .join("");
        if (thinking) opts.onThinking(thinking);
      }
    } catch {
      // ignore — on garde les buffers live
    }
    // eslint-disable-next-line no-console
    console.log(
      `[ollama] parts=${JSON.stringify(partCounts)} textLen=${buffer.length} thinkLen=${thinking.length}`
    );
    if (!cancelled && !abort.signal.aborted) {
      opts.onDone(buffer, thinking);
    }
  })();

  return { cancel };
}
