// Store central — état complet + actions (phase 3, agent réel phase 6).
// Remplace les useState du App.tsx phase 2.
// Sync conversations : la 1re send dans un chat vide crée la
// conversation, et chaque envoi est resynchronisé dedans.
// Phase 6 : streaming réel Ollama Cloud (`src/lib/ollama.ts`), `mockAgent`
// supprimé (pas de fallback). `ToneType` UI remplacé par `Mode`.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  GENERIC_SCENARIO,
  INITIAL_CONVERSATIONS,
  SCENARIOS,
} from "@/constants/scenarios";
import {
  streamOllamaResponse,
  type OllamaStreamHandle,
} from "@/lib/ollama";
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

const getFollowUps = (scId?: string): string[] =>
  (scId && SCENARIOS[scId]?.fu) || GENERIC_SCENARIO.fu;

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
  webEnabled: boolean;
  isStreaming: boolean;
  pending: PendingStream | null;
  followUpOpen: boolean;
  followUpQuestions: string[];
  voiceOpen: boolean;
  accessOpen: boolean;
  perms: DevicePerms;
  kebabOpen: boolean;
  sheetOpen: boolean;
  listOpen: boolean;

  toggleTheme: () => void;
  showToast: (message: string) => void;
  setInput: (value: string) => void;
  attach: (type: "photo" | "file") => void;
  removeAttachment: (type: "photo" | "file") => void;
  toggleWeb: () => void;
  setMode: (mode: Mode) => void;
  toggleKebab: () => void;
  closeKebab: () => void;
  openSheet: () => void;
  closeSheet: () => void;
  openVoice: () => void;
  closeVoice: () => void;
  openAccess: () => void;
  closeAccess: () => void;
  continueAccess: () => void;
  openList: () => void;
  closeList: () => void;
  openFollowUp: (scId?: string) => void;
  closeFollowUp: () => void;
  enablePerm: (key: keyof DevicePerms) => void;
  sendMessage: (text?: string, att?: AttachmentState) => void;
  regenerate: (aiMsgId: string) => void;
  selectConversation: (conv: ConversationHistoryItem) => void;
  newChat: () => void;
  toggleFav: (convId: string) => void;
  deleteConversation: (convId: string) => void;
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
      webEnabled: false,
      isStreaming: false,
      pending: null,
      followUpOpen: false,
      followUpQuestions: [],
      voiceOpen: false,
      accessOpen: false,
      perms: { a11y: false, capture: false },
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

  toggleWeb: () => {
    const next = !get().webEnabled;
    set({ webEnabled: next });
    get().showToast(next ? "Web search on" : "Web search off");
  },

  setMode: (mode) => {
    set({ mode });
    get().showToast(`Mode set to ${mode}`);
  },

  toggleKebab: () => set((s) => ({ kebabOpen: !s.kebabOpen })),
  closeKebab: () => set({ kebabOpen: false }),
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => {
    try { navigator.vibrate?.(15); } catch {}
    set({ sheetOpen: false });
  },
  openVoice: () => set({ voiceOpen: true }),
  closeVoice: () => set({ voiceOpen: false }),
  openAccess: () => set({ accessOpen: true }),
  closeAccess: () => set({ accessOpen: false }),
  continueAccess: () => {
    set({ accessOpen: false });
    get().showToast("Oh-Matilda can now act on your phone");
  },
  openList: () => set({ listOpen: true }),
  closeList: () => set({ listOpen: false }),

  openFollowUp: (scId) =>
    set({ followUpQuestions: getFollowUps(scId), followUpOpen: true }),
  closeFollowUp: () => set({ followUpOpen: false }),

  enablePerm: (key) => {
    get().showToast("Opening Android settings (simulated)");
    if (permTimer !== null) window.clearTimeout(permTimer);
    permTimer = window.setTimeout(() => {
      try { navigator.vibrate?.(20); } catch {}
      set((s) => ({ perms: { ...s.perms, [key]: true } }));
      get().showToast(key === "a11y" ? "Accessibility granted" : "Screen capture granted");
    }, 550);
  },

  sendMessage: (text, att) => {
    const s = get();
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
      followUpOpen: false,
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
        const errText = `LLM unavailable: ${message}`;
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
        const errText = `LLM unavailable: ${message}`;
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
    }),
    {
      name: "oh-matilda",
      partialize: (s) => ({
        conversations: s.conversations,
        activeConvId: s.activeConvId,
        theme: s.theme,
        perms: s.perms,
        mode: s.mode,
        webEnabled: s.webEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
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
