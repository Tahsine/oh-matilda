// Bridge agent natif (POC phase 7) — parle au `AgentBridge`
// (addJavascriptInterface) de `MainActivity.kt`. Aujourd'hui : screenshot
// MediaProjection. Les gestures arrivent avec l'AccessibilityService.
export interface AgentBridgeJS {
  isAgentSupported?: () => boolean;
  isAccessibilityEnabled?: () => boolean;
  requestScreenshot?: () => void;
  openAccessibilitySettings?: () => boolean;
  openApp?: (packageName: string) => string;
  getUiTree?: () => string;
  agentTap?: (x: number, y: number) => string;
  agentSwipe?: (x1: number, y1: number, x2: number, y2: number, durationMs: number) => string;
  agentInput?: (text: string) => string;
  agentPress?: (which: string) => string;
}

declare global {
  interface Window {
    AgentBridge?: AgentBridgeJS;
    __onAgentScreenshot?: ((dataUrl: string) => void) | null;
    __onAgentScreenshotError?: ((message: string) => void) | null;
  }
}

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

export function isAgentBridgeAvailable(): boolean {
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
