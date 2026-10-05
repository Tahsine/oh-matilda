// Store central — état complet + actions (phase 3, agent réel phase 6).
// Remplace les useState du App.tsx phase 2.
// Sync conversations : la 1re send dans un chat vide crée la
// conversation, et chaque envoi est resynchronisé dedans.
// Phase 6 : streaming réel Ollama Cloud (`src/lib/ollama.ts`), `mockAgent`
// supprimé (pas de fallback). `ToneType` UI remplacé par `Mode`.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  INITIAL_CONVERSATIONS,
} from "@/constants/scenarios";
import {
  streamOllamaResponse,
  type OllamaStreamHandle,
} from "@/lib/ollama";
import { notifyAgentRun, requestAgentScreenshot } from "@/lib/agentBridge";
import { friendlyLlmError } from "@/lib/ollamaKey";
import { isAccessibilityEnabled } from "@/lib/agentTools";
import {
  runAgentTask,
  takeRunTrace,
  type AgentRunHandle,
  type AgentStep,
  type RunTraceEvent,
} from "@/lib/agentRunner";
import type {
  AttachmentState,
  ChatMessage,
  ConversationHistoryItem,
  DevicePerms,
  Mode,
} from "@/types";

export type Theme = "light" | "dark";

interface PendingStream {
  aiMsgId: string;
  target: string;
  convId: string;
}

const now = (): string =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

let toastTimer: number | null = null;
let permTimer: number | null = null;
let realStream: OllamaStreamHandle | null = null;
let agentHandle: AgentRunHandle | null = null;

export interface AgentRunState {
  id: string;
  prompt: string;
  convId: string;
  status: "running" | "done" | "error" | "cancelled";
  steps: AgentStep[];
  beforeShot: string | null;
  afterShot: string | null;
  summary: string;
  error?: string;
  /** Trace structurée : 1 event par appel tool. Non persistée en live. */
  trace?: RunTraceEvent[];
}

/** Enregistrement permanent d'un run (lisible des mois après, sans images). */
export interface RunRecord {
  id: string;
  convId: string;
  prompt: string;
  status: "done" | "error" | "cancelled";
  summary: string;
  error?: string;
  steps: AgentStep[];
  trace?: RunTraceEvent[];
  startedAt: number;
  finishedAt: number;
}

const MAX_RUN_HISTORY = 50;

// Attache les 2 messages d'ouverture au bon fil (bulle user immédiate +
// placeholder IA portant le runId : la carte vit sous ce message).
function attachRunMessages(
  conversations: ChatState["conversations"],
  convId: string,
  baseMessages: ChatMessage[],
  runId: string,
  userText: string
): { conversations: ChatState["conversations"]; messages: ChatMessage[] } {
  const timeStr = now();
  const next: ChatMessage[] = [
    { id: `u-${runId}`, sender: "user", text: userText, timestamp: timeStr, runId },
    { id: `a-${runId}`, sender: "ai", rawText: "", timestamp: timeStr, runId, isStreaming: true },
  ];
  return {
    conversations: conversations.map((c) =>
      c.id === convId ? { ...c, messages: [...c.messages, ...next] } : c
    ),
    messages: [...baseMessages, ...next],
  };
}

// Clôture d'un run : remplit le placeholder IA (jamais de doublon user).
function closeRunMessages(
  st: ChatState,
  runId: string,
  aiText: string
): Partial<ChatState> {
  const fill = (list: ChatMessage[]): ChatMessage[] =>
    list.map((m) =>
      m.id === `a-${runId}` ? { ...m, rawText: aiText, isStreaming: false } : m
    );
  return {
    conversations: st.conversations.map((c) => ({ ...c, messages: fill(c.messages) })),
    messages: fill(st.messages),
  };
}

// Snapshot permanent d'un run terminé (steps + trace texte, sans images).
function snapshotRun(
  st: ChatState,
  run: AgentRunState,
  status: RunRecord["status"],
  summary: string,
  error: string | undefined,
  startedAt: number
): Partial<ChatState> {
  const rec: RunRecord = {
    id: run.id,
    convId: run.convId,
    prompt: run.prompt,
    status,
    summary,
    error,
    steps: run.steps,
    trace: run.trace,
    startedAt,
    finishedAt: Date.now(),
  };
  return {
    runHistory: [...(st.runHistory ?? []), rec].slice(-MAX_RUN_HISTORY),
  };
}

const finalizeMessage = (list: ChatMessage[], p: PendingStream): ChatMessage[] =>
  list.map((m) =>
    m.id === p.aiMsgId ? { ...m, rawText: p.target, isStreaming: false } : m
  );

const cancelRealStream = (): void => {
  if (realStream !== null) {
    realStream.cancel();
    realStream = null;
  }
};

const lastUserText = (list: ChatMessage[]): string => {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].sender === "user" && list[i].text?.trim()) {
      return list[i].text as string;
    }
  }
  return "";
};

interface ChatState {
  theme: Theme;
  toast: string | null;
  messages: ChatMessage[];
  conversations: ConversationHistoryItem[];
  activeConvId: string | null;
  lastScId: string | undefined;
  input: string;
  attachments: AttachmentState;
  mode: Mode;
  /** Android-use strict : armé → tout send part en run sur l'appareil. */
  agentArmed: boolean;
  isStreaming: boolean;
  pending: PendingStream | null;
  accessOpen: boolean;
  perms: DevicePerms;
  screenshotPreview: string | null;
  isCapturing: boolean;
  agentRun: AgentRunState | null;
  /** Historique permanent des runs (persisté, relu sous les messages IA). */
  runHistory: RunRecord[];
  kebabOpen: boolean;
  sheetOpen: boolean;
  listOpen: boolean;

  toggleTheme: () => void;
  showToast: (message: string) => void;
  setInput: (value: string) => void;
  attach: (type: "photo" | "file") => void;
  removeAttachment: (type: "photo" | "file") => void;
  setMode: (mode: Mode) => void;
  toggleAgentArmed: () => void;
  toggleKebab: () => void;
  closeKebab: () => void;
  openSheet: () => void;
  closeSheet: () => void;
  openAccess: () => void;
  closeAccess: () => void;
  continueAccess: () => void;
  openList: () => void;
  closeList: () => void;
  enablePerm: (key: keyof DevicePerms) => void;
  captureScreen: () => void;
  startAgentTask: (prompt: string) => void;
  cancelAgentTask: () => void;
  sendMessage: (text?: string, att?: AttachmentState) => void;
  regenerate: (aiMsgId: string) => void;
  selectConversation: (conv: ConversationHistoryItem) => void;
  newChat: () => void;
  toggleFav: (convId: string) => void;
  deleteConversation: (convId: string) => void;
  deleteConversations: (convIds: string[]) => void;
}

type FinalizedSlice = Partial<
  Pick<ChatState, "messages" | "conversations" | "pending" | "isStreaming">
>;

const withPendingFinalized = (s: ChatState): FinalizedSlice => {
  if (!s.pending) return {};
  const p = s.pending;
  return {
    messages: finalizeMessage(s.messages, p),
    conversations: s.conversations.map((c) =>
      c.id === p.convId ? { ...c, messages: finalizeMessage(c.messages, p) } : c
    ),
    pending: null,
    isStreaming: false,
  };
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      theme: "light",
      toast: null,
      messages: [],
      conversations: INITIAL_CONVERSATIONS,
      activeConvId: null,
      lastScId: undefined,
      input: "",
      attachments: { photo: false, file: false },
      mode: "fast",
      agentArmed: false,
      isStreaming: false,
      pending: null,
      accessOpen: false,
      perms: { a11y: false, capture: false },
      screenshotPreview: null,
      isCapturing: false,
      agentRun: null,
      runHistory: [],
      kebabOpen: false,
      sheetOpen: false,
      listOpen: false,

  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

  showToast: (message) => {
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = window.setTimeout(() => set({ toast: null }), 2200);
  },

  setInput: (value) => set({ input: value }),

  attach: (type) =>
    set((s) => ({ attachments: { ...s.attachments, [type]: true } })),

  removeAttachment: (type) =>
    set((s) => ({ attachments: { ...s.attachments, [type]: false } })),

  setMode: (mode) => {
    set({ mode });
    get().showToast(`Mode set to ${mode}`);
  },

  toggleAgentArmed: () => {
    const next = !get().agentArmed;
    try { navigator.vibrate?.(20); } catch {}
    // Armement ⇒ fast forcé (le mode agent ignore think ; thinking
    // redevient choisissable au désarmement, toujours sur fast).
    set({ agentArmed: next, ...(next ? { mode: "fast" as const } : {}) });
    get().showToast(next ? "Agent mode on — messages will run on your phone" : "Agent mode off");
  },

  toggleKebab: () => set((s) => ({ kebabOpen: !s.kebabOpen })),
  closeKebab: () => set({ kebabOpen: false }),
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => {
    try { navigator.vibrate?.(15); } catch {}
    set({ sheetOpen: false });
  },
  openAccess: () =>
    set((s) => ({
      accessOpen: true,
      perms: { ...s.perms, a11y: isAccessibilityEnabled() || s.perms.a11y },
    })),
  closeAccess: () => set({ accessOpen: false }),
  continueAccess: () => {
    set({ accessOpen: false });
    get().showToast("Oh-Matilda can now act on your phone");
  },
  openList: () => set({ listOpen: true }),
  closeList: () => set({ listOpen: false }),


  enablePerm: (key) => {
    get().showToast("Opening Android settings (simulated)");
    if (permTimer !== null) window.clearTimeout(permTimer);
    permTimer = window.setTimeout(() => {
      try { navigator.vibrate?.(20); } catch {}
      set((s) => ({ perms: { ...s.perms, [key]: true } }));
      get().showToast(key === "a11y" ? "Accessibility granted" : "Screen capture granted");
    }, 550);
  },

  // POC phase 7 : vraie capture MediaProjection via AgentBridge natif.
  // Le consentement système est demandé par Android à la 1re capture.
  captureScreen: () => {
    if (get().isCapturing) return;
    set({ isCapturing: true });
    void requestAgentScreenshot().then(
      (dataUrl) => {
        try { navigator.vibrate?.(20); } catch {}
        set((s) => ({
          perms: { ...s.perms, capture: true },
          screenshotPreview: dataUrl,
          isCapturing: false,
        }));
        get().showToast("Screenshot captured");
      },
      (e) => {
        set({ isCapturing: false });
        get().showToast(`Capture failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    );
  },

  startAgentTask: (prompt) => {
    const s = get();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (s.agentRun?.status === "running") {
      get().showToast("Agent task already running");
      return;
    }
    // Pré-vol : sans service a11y, getUiTree/tap/input échoueraient en boucle.
    // (Android désactive le service à chaque réinstall — le réactiver d'abord.)
    if (!isAccessibilityEnabled()) {
      get().showToast("Enable the accessibility service first (Device access)");
      set((st) => ({ perms: { ...st.perms, a11y: false } }));
      return;
    }
    if (agentHandle !== null) {
      agentHandle.cancel();
      agentHandle = null;
    }
    try { navigator.vibrate?.(25); } catch {}
    const id = `run-${Date.now()}`;
    const runStartedAt = Date.now();
    const mode = s.mode;
    // Conversation liée dès le démarrage. Thread = conversation (mémoire
    // inter-runs), runId éphémère généré dans le driver.
    let convId = s.activeConvId;
    let nextConvs = s.conversations;
    if (!convId) {
      convId = `c-${Date.now()}`;
      const title = trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed;
      nextConvs = [
        { id: convId, title, time: now(), fav: false, messages: [] },
        ...s.conversations,
      ];
    }
    const runConvId: string = convId;
    // Bulle user immédiate + placeholder IA : la carte vit sous ce message.
    const baseMessages = s.activeConvId === runConvId ? s.messages : [];
    const opened = attachRunMessages(nextConvs, runConvId, baseMessages, id, trimmed);
    set({
      input: "",
      attachments: { photo: false, file: false },
      sheetOpen: false,
      listOpen: false,
      conversations: opened.conversations,
      activeConvId: runConvId,
      messages: opened.messages,
      agentRun: {
        id,
        prompt: trimmed,
        convId: runConvId,
        status: "running",
        steps: [],
        beforeShot: null,
        afterShot: null,
        summary: "",
      },
    });
    // Preuves avant/après désactivées en v1 (spec §10) : la boucle agent
    // n'appelle jamais la capture (boîte de consentement MediaProjection).
    notifyAgentRun("running", trimmed);
    // Thread LangGraph = conversation (mémoire inter-runs) : on passe
    // runConvId, le runId éphémère est généré dans le driver.
    agentHandle = runAgentTask(trimmed, mode, {
      onStep: (step) =>
        set((st) => st.agentRun?.id === id
          ? { agentRun: { ...st.agentRun, steps: [...st.agentRun.steps, step] } }
          : {}),
      onDone: (summary) => {
        agentHandle = null;
        const trace = takeRunTrace();
        set((st) => {
          if (st.agentRun?.id !== id) return {};
          const run = { ...st.agentRun, status: "done" as const, summary, trace };
          return {
            agentRun: run,
            ...closeRunMessages(st, id, summary),
            ...snapshotRun(st, run, "done", summary, undefined, runStartedAt),
            // Retour au chat résultat : tiroir fermé. Le retour
            // premier-plan natif est fait par bringAppFront (notif done).
            listOpen: false,
          };
        });
        get().showToast("Agent task done");
        notifyAgentRun("done", summary);
      },
      onError: (message) => {
        agentHandle = null;
        const trace = takeRunTrace();
        set((st) => {
          if (st.agentRun?.id !== id) return {};
          const run = { ...st.agentRun, status: "error" as const, error: message, trace };
          const aiText = `Agent task failed: ${message}`;
          return {
            agentRun: run,
            ...closeRunMessages(st, id, aiText),
            ...snapshotRun(st, run, "error", aiText, message, runStartedAt),
            listOpen: false,
          };
        });
        get().showToast("Agent task failed");
        notifyAgentRun("error", message);
      },
    }, runConvId);
  },

  cancelAgentTask: () => {
    if (agentHandle !== null) {
      agentHandle.cancel();
      agentHandle = null;
    }
    const s = get();
    if (s.agentRun?.status === "running") {
      const trace = takeRunTrace();
      const run = { ...s.agentRun, status: "cancelled" as const, trace };
      const aiText = "Agent task stopped.";
      set({
        agentRun: run,
        ...closeRunMessages(s, s.agentRun.id, aiText),
        ...snapshotRun(s, run, "cancelled", aiText, undefined, Date.now()),
        listOpen: false,
      });
      get().showToast("Agent task stopped");
      notifyAgentRun("cancelled", "Task stopped");
    }
  },

  sendMessage: (text, att) => {
    const s = get();
    // Android-use strict : armé → tout send part en run sur l'appareil.
    if (s.agentArmed) {
      const armedText = (text ?? s.input).trim();
      if (!armedText) return;
      get().startAgentTask(armedText);
      return;
    }
    const trimmed = (text ?? s.input).trim();
    const curAtt = att ?? s.attachments;
    if (!trimmed && !curAtt.photo && !curAtt.file) return;
    try { navigator.vibrate?.(25); } catch {}

    let baseMessages = s.messages;
    let baseConvs = s.conversations;
    if (s.pending) {
      const p = s.pending;
      baseMessages = finalizeMessage(baseMessages, p);
      baseConvs = baseConvs.map((c) =>
        c.id === p.convId ? { ...c, messages: finalizeMessage(c.messages, p) } : c
      );
    }

    const timeStr = now();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: trimmed || undefined,
      attachments: curAtt.photo || curAtt.file ? { ...curAtt } : undefined,
      timestamp: timeStr,
    };
    const aiMsgId = `a-${Date.now() + 1}`;
    const placeholder: ChatMessage = {
      id: aiMsgId,
      sender: "ai",
      rawText: "",
      thinking: "",
      isStreaming: true,
      timestamp: timeStr,
    };

    const nextMessages = [...baseMessages, userMsg, placeholder];

    let convId = s.activeConvId;
    let nextConvs: ConversationHistoryItem[];
    if (convId) {
      nextConvs = baseConvs.map((c) =>
        c.id === convId ? { ...c, messages: nextMessages } : c
      );
    } else {
      convId = `c-${Date.now()}`;
      const title = trimmed
        ? trimmed.length > 40
          ? trimmed.slice(0, 40) + "…"
          : trimmed
        : "New chat";
      nextConvs = [
        { id: convId, title, time: timeStr, fav: false, messages: nextMessages },
        ...baseConvs,
      ];
    }

    const pending: PendingStream = { aiMsgId, target: "", convId };
    const mode = s.mode;
    const history = baseMessages;

    set({
      input: "",
      attachments: { photo: false, file: false },
      messages: nextMessages,
      conversations: nextConvs,
      activeConvId: convId,
      lastScId: undefined,
      isStreaming: true,
      pending,
    });

    cancelRealStream();
    realStream = streamOllamaResponse({
      prompt: trimmed,
      mode,
      history,
      attachments: curAtt,
      onToken: (buffer) =>
        set((st) => ({
          messages: st.messages.map((m) =>
            m.id === aiMsgId ? { ...m, rawText: buffer, isStreaming: true } : m
          ),
          pending:
            st.pending && st.pending.aiMsgId === aiMsgId
              ? { ...st.pending, target: buffer }
              : st.pending,
        })),
      onThinking: (thinking) =>
        set((st) => ({
          messages: st.messages.map((m) =>
            m.id === aiMsgId ? { ...m, thinking } : m
          ),
        })),
      onDone: (finalText, thinking) => {
        realStream = null;
        const done = finalText.trim()
          ? finalText
          : "I didn't get a response — please try again.";
        const fin: PendingStream = { aiMsgId, target: done, convId };
        set((st) => ({
          isStreaming: false,
          pending: null,
          messages: st.messages.map((m) =>
            m.id === aiMsgId
              ? { ...m, rawText: done, thinking, isStreaming: false }
              : m
          ),
          conversations: st.conversations.map((c) =>
            c.id === convId ? { ...c, messages: finalizeMessage(c.messages, fin) } : c
          ),
        }));
      },
      onError: (message) => {
        realStream = null;
        const errText = `LLM unavailable: ${friendlyLlmError(message)}`;
        const fin: PendingStream = { aiMsgId, target: errText, convId };
        set((st) => ({
          isStreaming: false,
          pending: null,
          messages: st.messages.map((m) =>
            m.id === aiMsgId ? { ...m, rawText: errText, isStreaming: false } : m
          ),
          conversations: st.conversations.map((c) =>
            c.id === convId ? { ...c, messages: finalizeMessage(c.messages, fin) } : c
          ),
        }));
        get().showToast("LLM error — check OLLAMA_API_KEY");
      },
    });
  },

  regenerate: (aiMsgId) => {
    const s = get();
    get().showToast("Regenerating…");
    const msg = s.messages.find((m) => m.id === aiMsgId);
    if (!msg || msg.sender !== "ai") return;

    cancelRealStream();
    const history = s.messages.filter((m) => m.id !== aiMsgId);
    const prompt = lastUserText(history) || "Please answer again.";
    const convId = s.activeConvId ?? "";
    const mode = s.mode;
    const pending: PendingStream = { aiMsgId, target: "", convId };

    set({
      isStreaming: true,
      pending,
      messages: s.messages.map((m) =>
        m.id === aiMsgId ? { ...m, rawText: "", thinking: "", isStreaming: true } : m
      ),
    });

    realStream = streamOllamaResponse({
      prompt,
      mode,
      history,
      attachments: s.attachments,
      onToken: (buffer) =>
        set((st) => ({
          messages: st.messages.map((m) =>
            m.id === aiMsgId ? { ...m, rawText: buffer, isStreaming: true } : m
          ),
          pending:
            st.pending && st.pending.aiMsgId === aiMsgId
              ? { ...st.pending, target: buffer }
              : st.pending,
        })),
      onThinking: (thinking) =>
        set((st) => ({
          messages: st.messages.map((m) =>
            m.id === aiMsgId ? { ...m, thinking } : m
          ),
        })),
      onDone: (finalText, thinking) => {
        realStream = null;
        const done = finalText.trim()
          ? finalText
          : "I didn't get a response — please try again.";
        const fin: PendingStream = { aiMsgId, target: done, convId };
        set((st) => ({
          isStreaming: false,
          pending: null,
          messages: st.messages.map((m) =>
            m.id === aiMsgId
              ? { ...m, rawText: done, thinking, isStreaming: false }
              : m
          ),
          conversations: convId
            ? st.conversations.map((c) =>
                c.id === convId
                  ? { ...c, messages: finalizeMessage(c.messages, fin) }
                  : c
              )
            : st.conversations,
        }));
      },
      onError: (message) => {
        realStream = null;
        const errText = `LLM unavailable: ${friendlyLlmError(message)}`;
        const fin: PendingStream = { aiMsgId, target: errText, convId };
        set((st) => ({
          isStreaming: false,
          pending: null,
          messages: st.messages.map((m) =>
            m.id === aiMsgId ? { ...m, rawText: errText, isStreaming: false } : m
          ),
          conversations: convId
            ? st.conversations.map((c) =>
                c.id === convId
                  ? { ...c, messages: finalizeMessage(c.messages, fin) }
                  : c
              )
            : st.conversations,
        }));
        get().showToast("LLM error — check OLLAMA_API_KEY");
      },
    });
  },

  selectConversation: (conv) => {
    cancelRealStream();
    const s = get();
    const fin = withPendingFinalized(s);
    const convs = fin.conversations ?? s.conversations;
    const target = convs.find((c) => c.id === conv.id);
    if (!target) return;
    const lastAi = target.messages.filter((m) => m.sender === "ai").slice(-1)[0];
    set({
      ...fin,
      activeConvId: target.id,
      messages: target.messages,
      lastScId: lastAi?.scId,
    });
    get().showToast(`Opened: ${target.title}`);
  },

  newChat: () => {
    cancelRealStream();
    const fin = withPendingFinalized(get());
    set({
      ...fin,
      activeConvId: null,
      messages: [],
      lastScId: undefined,
      input: "",
      attachments: { photo: false, file: false },
    });
    get().showToast("New chat started");
  },

  toggleFav: (convId) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, fav: !c.fav } : c
      ),
    })),

  deleteConversation: (convId) => {
    cancelRealStream();
    const s = get();
    const fin = withPendingFinalized(s);
    const wasActive = s.activeConvId === convId;
    try { navigator.vibrate?.(40); } catch {}
    set({
      ...fin,
      conversations: (fin.conversations ?? s.conversations).filter(
        (c) => c.id !== convId
      ),
      ...(wasActive ? { activeConvId: null, messages: [] } : {}),
    });
    get().showToast("Conversation deleted");
  },

  deleteConversations: (convIds) => {
    if (convIds.length === 0) return;
    cancelRealStream();
    const s = get();
    const fin = withPendingFinalized(s);
    const ids = new Set(convIds);
    const wasActive = s.activeConvId !== null && ids.has(s.activeConvId);
    try { navigator.vibrate?.(40); } catch {}
    set({
      ...fin,
      conversations: (fin.conversations ?? s.conversations).filter(
        (c) => !ids.has(c.id)
      ),
      ...(wasActive ? { activeConvId: null, messages: [] } : {}),
    });
    get().showToast(
      convIds.length === 1 ? "Conversation deleted" : `${convIds.length} conversations deleted`
    );
  },
    }),
    {
      name: "oh-matilda",
      partialize: (s) => ({
        conversations: s.conversations,
        activeConvId: s.activeConvId,
        runHistory: (s.runHistory ?? []).slice(-MAX_RUN_HISTORY),
        theme: s.theme,
        perms: s.perms,
        mode: s.mode,
        // agentArmed VOLONTAIREMENT absent : toujours désarmé au lancement.
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Toujours désarmé au lancement (même si une vieille sauvegarde
        // persistait agentArmed: true).
        state.agentArmed = false;
        if (state.activeConvId) {
          const conv = state.conversations.find((c) => c.id === state.activeConvId);
          if (conv) {
            state.messages = conv.messages;
            const lastAi = conv.messages.filter((m) => m.sender === "ai").slice(-1)[0];
            state.lastScId = lastAi?.scId;
          }
        }
      },
    }
  )
);
