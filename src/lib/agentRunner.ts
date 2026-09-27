// Runner agent UI-use (phase 7) — boucle observe → agit → vérifie.
// Piloté par Vercel AI SDK (`tool()` + `stopWhen`), exécution native via
// `agentTools.ts`. gpt-oss:20b est texte seul : la vérification passe par
// `getUiTree` (texte), les screenshots servent de reçus humains (before/after).
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { streamText, stepCountIs, tool } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { z } from "zod";
import {
  agentInput,
  agentPress,
  agentSwipe,
  agentTap,
  getUiTree,
  openApp,
} from "./agentTools";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "./ollama";
import type { Mode } from "@/types";

const MAX_STEPS = 8;
const MAX_TREE_CHARS = 8000;

const AGENT_SYSTEM_FAST =
  "You are Oh-Matilda, a phone-control agent. You act on the user's Android phone by calling tools. " +
  "Screen coordinates are physical pixels on a 1080x1920 display. " +
  "Always follow observe-act-verify: read getUiTree, act once, then read getUiTree again to confirm. " +
  "If an action fails, adapt (re-read the tree, tap corrected coordinates). " +
  "Never touch password fields. Never open apps outside the task. " +
  "When the task is done, summarize briefly what you did.";

const AGENT_SYSTEM_THINKING =
  "You are Oh-Matilda, a phone-control agent. Reason step by step, then act on the user's Android phone by calling tools. " +
  "Screen coordinates are physical pixels on a 1080x1920 display. " +
  "Always follow observe-act-verify: read getUiTree, act once, then read getUiTree again to confirm. " +
  "If an action fails, adapt (re-read the tree, tap corrected coordinates). " +
  "Never touch password fields. Never open apps outside the task. " +
  "When the task is done, summarize briefly what you did.";

export interface AgentStep {
  label: string;
  detail: string;
}

export interface AgentRunCallbacks {
  onStep: (step: AgentStep) => void;
  onDone: (summary: string) => void;
  onError: (message: string) => void;
}

export interface AgentRunHandle {
  cancel: () => void;
}

function pushStep(cb: AgentRunCallbacks, label: string, detail: string): string {
  const d = detail.length > 400 ? `${detail.slice(0, 400)}…` : detail;
  cb.onStep({ label, detail: d });
  return detail;
}

export function runAgentTask(
  prompt: string,
  mode: Mode,
  cb: AgentRunCallbacks
): AgentRunHandle {
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
      if (!cancelled) cb.onError(e instanceof Error ? e.message : String(e));
      return;
    }
    const provider = createOllama({
      baseURL: OLLAMA_BASE_URL,
      headers: { Authorization: `Bearer ${key}` },
      fetch: tauriFetch as typeof fetch,
    });

    const tools = {
      openApp: tool({
        description: "Open an Android app by package name (allowlisted natively)",
        inputSchema: z.object({ package: z.string() }),
        execute: async ({ package: pkg }) => {
          const r = await openApp(pkg);
          return pushStep(cb, `open ${pkg}`, JSON.stringify(r));
        },
      }),
      getUiTree: tool({
        description: "Read the current screen UI tree (text, bounds, clickable). Call after each action to verify.",
        inputSchema: z.object({}),
        execute: async () => {
          const r = await getUiTree();
          const raw = JSON.stringify(r);
          const out = raw.length > MAX_TREE_CHARS ? `${raw.slice(0, MAX_TREE_CHARS)}…[truncated]` : raw;
          return pushStep(cb, "read screen", out);
        },
      }),
      tap: tool({
        description: "Tap at physical pixel coordinates x,y",
        inputSchema: z.object({ x: z.number(), y: z.number() }),
        execute: async ({ x, y }) => {
          const r = await agentTap(x, y);
          return pushStep(cb, `tap ${Math.round(x)},${Math.round(y)}`, JSON.stringify(r));
        },
      }),
      swipe: tool({
        description: "Swipe from x1,y1 to x2,y2 over durationMs",
        inputSchema: z.object({
          x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(),
          durationMs: z.number().optional(),
        }),
        execute: async ({ x1, y1, x2, y2, durationMs }) => {
          const r = await agentSwipe(x1, y1, x2, y2, durationMs ?? 400);
          return pushStep(cb, "swipe", JSON.stringify(r));
        },
      }),
      inputText: tool({
        description: "Type text into the focused editable field (never passwords)",
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => {
          const r = await agentInput(text);
          return pushStep(cb, `type "${text.slice(0, 40)}"`, JSON.stringify(r));
        },
      }),
      press: tool({
        description: "Press a system button: back, home or recents",
        inputSchema: z.object({ which: z.enum(["back", "home", "recents"]) }),
        execute: async ({ which }) => {
          const r = await agentPress(which);
          return pushStep(cb, `press ${which}`, JSON.stringify(r));
        },
      }),
    };

    try {
      const result = await streamText({
        model: provider(OLLAMA_MODEL as never),
        system: mode === "thinking" ? AGENT_SYSTEM_THINKING : AGENT_SYSTEM_FAST,
        prompt,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
        providerOptions: { ollama: { think: mode === "thinking" } },
        abortSignal: abort.signal,
      });
      // Consomme le stream (les execute tournent pendant l'itération).
      for await (const _part of result.fullStream) {
        if (cancelled || abort.signal.aborted) return;
      }
      if (cancelled || abort.signal.aborted) return;
      const text = await result.text;
      cb.onDone(text.trim() || "Task finished.");
    } catch (e) {
      if (!cancelled && !abort.signal.aborted) {
        cb.onError(e instanceof Error ? e.message : String(e));
      }
    }
  })();

  return { cancel };
}


