// Façade des méthodes natives v1 (spec §4) — réécriture complète.
// Tout passe par callNative (async). Les erreurs métier (ok:false) sont des
// RÉSULTATS, pas des exceptions. Conservés pour l'UI : openAccessibilitySettings,
// isAccessibilityEnabled.
import { callNative, type AgentBridgeJS } from "./agentBridge";

export type NativeCode =
  | "service_off"
  | "stale"
  | "ambiguous"
  | "not_found"
  | "refused"
  | "timeout"
  | "transport"
  | "unsupported";

export interface ScreenElement {
  id: number;
  role: string;
  label: string;
}

export interface ScreenState {
  v: number;
  pkg: string;
  app: string;
  kbd: boolean;
  settled: boolean;
  sig: string;
  text: string;
  els: ScreenElement[];
  dialog?: boolean;
  truncated?: boolean;
}

export interface NativeResult {
  ok: boolean;
  error?: string;
  code?: NativeCode;
  changed?: boolean;
  at_end?: boolean;
  screen?: ScreenState;
  shot?: string;
}

function bridge(): AgentBridgeJS {
  if (!window.AgentBridge) {
    throw new Error("agent bridge unavailable (native build?)");
  }
  return window.AgentBridge;
}

async function call(method: string, args: Record<string, unknown> = {}, timeoutMs = 15000): Promise<NativeResult> {
  const raw = await callNative(method, args, timeoutMs);
  return JSON.parse(raw) as NativeResult;
}

/** Appel natif générique (fabrique de tools LangChain). */
export async function callMethod(
  method: string,
  args: Record<string, unknown> = {},
  timeoutMs = 15000
): Promise<NativeResult> {
  return call(method, args, timeoutMs);
}

export function isAccessibilityEnabled(): boolean {
  try {
    return bridge().isAccessibilityEnabled?.() ?? false;
  } catch {
    return false;
  }
}

export function openAccessibilitySettings(): boolean {
  try {
    return bridge().openAccessibilitySettings?.() ?? false;
  } catch {
    return false;
  }
}

export async function observe(): Promise<NativeResult> {
  return call("observe");
}

/** Heartbeat : prouve que le JS respire (watchdog natif). Jamais bloquant. */
export async function ping(): Promise<void> {
  try {
    await call("ping", {}, 8000);
  } catch {
    // ignore : le watchdog détectera le silence
  }
}

export async function tap(id: number): Promise<NativeResult> {
  return call("tap", { id });
}

export async function longPress(id: number): Promise<NativeResult> {
  return call("longPress", { id });
}

export async function typeText(
  id: number,
  text: string,
  submit = false,
  append = false
): Promise<NativeResult> {
  return call("type", { id, text, submit, append });
}

export async function scroll(id: number, dir: string): Promise<NativeResult> {
  return call("scroll", { id, dir });
}

/** Geste humain libre : swipe depuis un point (défaut : centre) + direction + distance px. */
export async function swipe(
  dir: string,
  dist = 500,
  x?: number,
  y?: number
): Promise<NativeResult> {
  const args: Record<string, unknown> = { dir, dist };
  if (x !== undefined) args["x"] = x;
  if (y !== undefined) args["y"] = y;
  return call("swipe", args);
}

export async function press(key: "back" | "home" | "recents"): Promise<NativeResult> {
  return call("press", { key });
}

export async function openApp(name: string): Promise<NativeResult> {
  return call("openApp", { name }, 20000);
}

export async function waitMs(ms: number): Promise<NativeResult> {
  return call("wait", { ms }, 15000);
}

/** Positionne le flag d'interruption natif (settle/wait en cours). Best effort. */
export async function cancelNative(): Promise<void> {
  try {
    await call("cancel", {}, 3000);
  } catch {
    // ignore : lAbortController JS reste la source de vérité
  }
}

/** Preuve optionnelle API ≥ 30 (hors boucle). */
export async function screenshotNative(): Promise<NativeResult> {
  return call("screenshot", {}, 15000);
}
