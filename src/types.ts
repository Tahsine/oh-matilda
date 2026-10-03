// Types canoniques — extrait net de oh-matilda-—-ai-agent-chat/src/types.ts:1-62
// Corrige NodeJS.Timeout -> number pour Tauri/WebView

export type ToneType = 'formal' | 'friendly' | 'concise';

// Mode agent réel (phase 6) — remplace ToneType côté UI/store.
// ToneType est conservé pour `Scenario.r` (seeds + démo ActionProofCard).
export type Mode = 'fast' | 'thinking';

export interface ActionProof {
  app: string;
  desc: string;
  before: string; // data-uri SVG
  after: string;
}

export interface Scenario {
  kw: string[];
  thought?: string;
  viewed?: string;
  img?: string;
  r: Record<ToneType, string>;
  action?: ActionProof;
  fu: string[];
}

export interface AttachmentState {
  photo: boolean;
  file: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  rawText?: string;
  thinking?: string;
  scId?: string;
  attachments?: AttachmentState;
  isStreaming?: boolean;
  timestamp: string;
  liked?: boolean;
  disliked?: boolean;
  /** Run agent lié (carte sous le message IA, permanente). */
  runId?: string;
}

export interface ConversationHistoryItem {
  id: string;
  title: string;
  time: string;
  fav: boolean;
  archived?: boolean;
  messages: ChatMessage[];
}

export interface DevicePerms {
  a11y: boolean;
  capture: boolean;
}
