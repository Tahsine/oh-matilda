// Bridge agent NATIF v1 (spec §4) — réécriture complète.
// Canal unique ASYNCHRONE : call(reqId, method, argsJson) → __agentResolve.
// Le natif ne bloque jamais le thread JS (settle/observe ≈ secondes).
// Conservés : notifyAgentRun, onAgentStopRequest, isAgentBridgeAvailable,
// requestAgentScreenshot (POC capture séparé, la boucle ne l'appelle jamais).
export interface AgentBridgeJS {
  isAgentSupported?: () => boolean;
  isAccessibilityEnabled?: () => boolean;
  requestScreenshot?: () => void;
  openAccessibilitySettings?: () => boolean;
  call?: (reqId: string, method: string, argsJson: string) => void;
  agentRunNotify?: (status: string, text: string) => void;
  setStatusBarDark?: (dark: boolean) => void;
}

declare global {
  interface Window {
    AgentBridge?: AgentBridgeJS;
    __agentResolve?: ((id: string, resultJson: string) => void) | null;
    __onAgentScreenshot?: ((dataUrl: string) => void) | null;
    __onAgentScreenshotError?: ((message: string) => void) | null;
    __onAgentStop?: (() => void) | null;
  }
}

export type AgentRunNotifStatus = "running" | "done" | "error" | "cancelled";

/** Notification native du run (Stop hors app + retour tap). Best effort. */
export function notifyAgentRun(status: AgentRunNotifStatus, text: string): void {
  try {
    window.AgentBridge?.agentRunNotify?.(status, text);
  } catch {
    // ignore (Web hors natif)
  }
}

/** Icônes status bar : claires en dark, sombres en light. Best effort. */
export function setStatusBarDark(dark: boolean): void {
  try {
    window.AgentBridge?.setStatusBarDark?.(dark);
  } catch {
    // ignore (Web hors natif)
  }
}

/** Enregistre le callback du bouton Stop de la notification. */
export function onAgentStopRequest(cb: () => void): void {
  window.__onAgentStop = () => {
    try {
      cb();
    } catch {
      // ignore
    }
  };
}

// ---------- canal async call → __agentResolve (§4.1) ----------

interface PendingCall {
  resolve: (resultJson: string) => void;
  reject: (e: Error) => void;
  timer: number;
}

const pending = new Map<string, PendingCall>();
let reqSeq = 0;

function ensureResolveHook(): void {
  try {
    if (typeof window.__agentResolve !== "function") {
      window.__agentResolve = (id: string, resultJson: string) => {
        const p = pending.get(id);
        if (!p) return;
        pending.delete(id);
        window.clearTimeout(p.timer);
        p.resolve(resultJson);
      };
    }
  } catch {
    // ignore (hors WebView)
  }
}

/**
 * Appel natif : résout avec le JSON brut (NativeResult), rejette sur
 * timeout ou bridge absent. Les erreurs métier (ok:false) NE rejettent PAS.
 */
export function callNative(
  method: string,
  args: Record<string, unknown> = {},
  timeoutMs = 15000
): Promise<string> {
  ensureResolveHook();
  const bridge = window.AgentBridge;
  if (!bridge || typeof bridge.call !== "function") {
    return Promise.reject(new Error("agent bridge unavailable (native build?)"));
  }
  const reqId = `r${(reqSeq += 1)}`;
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(reqId);
      reject(new Error(`native ${method} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(reqId, { resolve, reject, timer });
    try {
      // Appel ATTACHÉ à l'objet injecté : un appel détaché
      // (const f = bridge.call; f()) meurt côté natif avec
      // "can't be invoked on a non-injected object".
      bridge.call!(reqId, method, JSON.stringify(args));
    } catch (e) {
      pending.delete(reqId);
      window.clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

export function isAgentBridgeAvailable(): boolean {
  try {
    return typeof window.AgentBridge?.call === "function";
  } catch {
    return false;
  }
}

// ---------- capture POC séparée (hors boucle agent) ----------

const TIMEOUT_MS = 45000;

let inFlight: {
  resolve: (dataUrl: string) => void;
  reject: (reason: unknown) => void;
  timer: number;
} | null = null;

function settleOk(dataUrl: string): void {
  if (!inFlight) return;
  const f = inFlight;
  inFlight = null;
  window.clearTimeout(f.timer);
  f.resolve(dataUrl);
}

function settleErr(message: string): void {
  if (!inFlight) return;
  const f = inFlight;
  inFlight = null;
  window.clearTimeout(f.timer);
  f.reject(new Error(message));
}

export function isScreenshotBridgeAvailable(): boolean {
  try {
    return typeof window.AgentBridge?.requestScreenshot === "function";
  } catch {
    return false;
  }
}

/** Capture d'écran réelle via MediaProjection. Resout avec un data-URL JPEG. */
export function requestAgentScreenshot(): Promise<string> {
  if (inFlight) {
    return Promise.reject(new Error("capture already in flight"));
  }
  const bridge = window.AgentBridge;
  if (!bridge || typeof bridge.requestScreenshot !== "function") {
    return Promise.reject(new Error("agent bridge unavailable (native build?)"));
  }
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      settleErr("capture timeout (consent? foreground service?)");
    }, TIMEOUT_MS);
    inFlight = { resolve, reject, timer };
    window.__onAgentScreenshot = settleOk;
    window.__onAgentScreenshotError = settleErr;
    try {
      bridge.requestScreenshot!();
    } catch (e) {
      settleErr(e instanceof Error ? e.message : String(e));
    }
  });
}
