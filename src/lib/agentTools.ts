// Primitives UI-use génériques (phase 7) — appel direct JS → AgentBridge
// Kotlin (prouvé par le POC screenshot). Pas de détour Rust en POC :
// les guardrails vivent côté natif. `screenshot()` réutilise agentBridge.ts.
import {
  isAgentBridgeAvailable,
  requestAgentScreenshot,
} from "./agentBridge";

export interface UiNode {
  t?: string;
  d?: string;
  cls?: string;
  b: [number, number, number, number];
  c?: boolean;
  s?: boolean;
  e?: boolean;
  p?: boolean;
  kids?: UiNode[];
}

export interface UiTreeResult {
  ok: boolean;
  package?: string;
  tree?: UiNode;
  truncated?: boolean;
  error?: string;
}

export interface ActionResult {
  ok: boolean;
  action?: string;
  error?: string;
}

import type { AgentBridgeJS } from "./agentBridge";

function bridge(): AgentBridgeJS {
  if (!isAgentBridgeAvailable() || !window.AgentBridge) {
    throw new Error("agent bridge unavailable (native build?)");
  }
  return window.AgentBridge;
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T;
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

export async function openApp(packageName: string): Promise<ActionResult> {
  const raw = bridge().openApp?.(packageName) ?? '{"ok":false,"error":"no bridge"}';
  return parse<ActionResult>(raw);
}

export async function getUiTree(): Promise<UiTreeResult> {
  const raw = bridge().getUiTree?.() ?? '{"ok":false,"error":"no bridge"}';
  return parse<UiTreeResult>(raw);
}

export async function agentTap(x: number, y: number): Promise<ActionResult> {
  const raw = bridge().agentTap?.(x, y) ?? '{"ok":false,"error":"no bridge"}';
  return parse<ActionResult>(raw);
}

export async function agentSwipe(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  durationMs = 400
): Promise<ActionResult> {
  const raw =
    bridge().agentSwipe?.(x1, y1, x2, y2, durationMs) ?? '{"ok":false,"error":"no bridge"}';
  return parse<ActionResult>(raw);
}

export async function agentInput(text: string): Promise<ActionResult> {
  const raw = bridge().agentInput?.(text) ?? '{"ok":false,"error":"no bridge"}';
  return parse<ActionResult>(raw);
}

export async function agentPress(which: "back" | "home" | "recents"): Promise<ActionResult> {
  const raw = bridge().agentPress?.(which) ?? '{"ok":false,"error":"no bridge"}';
  return parse<ActionResult>(raw);
}

export async function agentScreenshot(): Promise<string> {
  return requestAgentScreenshot();
}
