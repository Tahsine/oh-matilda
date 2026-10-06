// Driver agent LangGraph — boucle model ⇄ tools (createAgent customisé).
// Tools : observe (screenshot, uitree) + actes (tap, open_app, type,
// scroll, back, swipe, long_press) + finish.
// Middleware : revisite (dernier recours) + ender. PAS de plafond
// d'appels modèle (retiré : tuait les longs runs légitimes) — filet =
// budget steps large + deadline + garde stuck + Stop utilisateur.
// Thread checkpointer = conversation (mémoire inter-runs).
// Contrat public INCHANGÉ : store/UI intacts.
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { createAgent } from "langchain";
import { revisitMiddleware } from "./agentGuardsLite";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { OllamaAgentModel } from "./agentModel";
import { createObserveTools } from "./agentObserve";
import { createActTools } from "./agentAct";
import { SYSTEM_PROMPT } from "./agentPrompt";
import { RUN_DEADLINE_MS } from "./agentRunLimits";
import { cancelNative, ping } from "./agentTools";
import { requestAgentScreenshot } from "./agentBridge";
import type { Mode } from "@/types";

const MODEL = "gemma4:31b";
const API_URL = "https://ollama.com/api/chat";
const LLM_TIMEOUT_MS = 45000;
const LLM_BACKOFFS = [1500, 4000, 8000];
const RECURSION_LIMIT = 200;
// Filet anti-emballement : budget STEPS large par run (style AndroidWorld,
// ~2x le plus long run légitime observé ≈ 38 steps) + deadline + stuck.
// Jamais de plafond d'appels modèle : un long run légitime ne doit pas mourir.
// Phase perception : observer suffit large (pas d'actions, pas de boucles).

export interface AgentStep {
  label: string;
  detail: string;
}

export interface RunTraceEvent {
  seq: number;
  tool: string;
  args: unknown;
  ok: boolean;
  error?: string;
  t: number;
  pkg?: string;
}

export interface AgentRunCallbacks {
  onStep: (step: AgentStep) => void;
  onDone: (summary: string) => void;
  onError: (message: string) => void;
  onAskUser?: (question: string) => Promise<"confirm" | "cancel">;
}

export interface AgentRunHandle {
  cancel: () => void;
}

interface EndState {
  status: "success" | "failed";
  summary: string;
}

/** Un seul checkpointer pour tous les runs (mémoire par conversation). */
const checkpointer = new MemorySaver();

let lastTrace: RunTraceEvent[] = [];

export function takeRunTrace(): RunTraceEvent[] {
  const t = lastTrace;
  lastTrace = [];
  return t;
}

function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const t = window.setTimeout(() => resolve(true), ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(t);
      resolve(false);
    }, { once: true });
  });
}

export function runAgentTask(
  prompt: string,
  _mode: Mode,
  cb: AgentRunCallbacks,
  threadId: string
): AgentRunHandle {
  void _mode;
  const abort = new AbortController();
  let cancelled = false;
  let hb: number | null = null;
  const stopHb = (): void => {
    if (hb !== null) {
      try {
        window.clearInterval(hb);
      } catch {
        // ignore
      }
      hb = null;
    }
  };

  const cancel = (): void => {
    cancelled = true;
    stopHb();
    try {
      abort.abort();
    } catch {
      // ignore
    }
    void cancelNative();
  };

  void (async () => {
    try {
      console.log("[agent] runner v11 verify-narrow langgraph");
    } catch {
      // ignore
    }
    const signal = abort.signal;
    let key: string;
    try {
      // Clé device (store) d'abord, compilée en repli.
      const { getOllamaKey, friendlyLlmError } = await import("./ollamaKey");
      key = await getOllamaKey();
      if (!key) throw new Error(friendlyLlmError("missing api key"));
    } catch (e) {
      if (!cancelled) cb.onError(e instanceof Error ? e.message : String(e));
      return;
    }
    lastTrace = [];
    const runStartAt = Date.now();
    const fgState = (): string => {
      try {
        return document.hidden ? "bg" : "fg";
      } catch {
        return "?";
      }
    };

    const stepLine = (label: string, detail: string): void => {
      const d = detail.length > 400 ? `${detail.slice(0, 400)}…` : detail;
      cb.onStep({ label, detail: d });
    };

    const pushTrace = (tool: string, args: unknown, ok: boolean, error?: string, pkg?: string): void => {
      const t = Date.now() - runStartAt;
      const ev: RunTraceEvent = { seq: lastTrace.length + 1, tool, args, ok, error, t, pkg };
      lastTrace.push(ev);
      // eslint-disable-next-line no-console
      console.log(`[agent-trace] t=${t}ms ${fgState()} pkg=${pkg ?? "?"}`, JSON.stringify(ev));
    };

    const endWith = (status: "success" | "failed", summary: string): void => {
      stopHb();
      if (cancelled || signal.aborted) return;
      if (status === "success") cb.onDone(summary);
      else cb.onError(summary);
    };

    // Screenshots max 2 : [précédent, courant]. L'adapteur joint le courant.
    const shots: Array<string | null> = [null, null];
    // Dernier écran vu (revisites) + run id (frontière middleware).
    let lastSig = "";
    let lastPkg = "";
    const runId = `run-${Date.now()}`;
    const noteScreen = (sig: string, pkg: string): void => {
      if (sig) lastSig = sig;
      if (pkg) lastPkg = pkg;
    };
    const recordTrace = (tool: string, args: unknown, ok: boolean, error?: string): void => {
      pushTrace(tool, args, ok, error, lastPkg || undefined);
    };
    const SHOT_TIMEOUT_MS = 15000;
    const refreshShot = async (): Promise<void> => {
      try {
        const shot: string = await Promise.race([
          requestAgentScreenshot(),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("shot timeout")), SHOT_TIMEOUT_MS);
          }),
        ]);
        if (!signal.aborted && shot) {
          shots[0] = shots[1];
          shots[1] = shot;
        }
      } catch {
        // ignore : tour sans image
      }
    };
    // Ref objet (pas de narrowing TS : écrit par les tools).
    const endRef: { current: EndState | null } = { current: null };
    let deadlineHit = false;

    const fetchWithRetry = async (url: string, init: RequestInit): Promise<Response> => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 1 + LLM_BACKOFFS.length; attempt += 1) {
        if (signal.aborted) throw new Error("cancelled");
        if (attempt > 0) {
          // eslint-disable-next-line no-console
          console.log(`[agent-llm] retry ${attempt}/${LLM_BACKOFFS.length}`);
          if (!(await sleep(LLM_BACKOFFS[attempt - 1], signal))) throw new Error("cancelled");
        }
        try {
          const r = await tauriFetch(url, {
            method: "POST",
            headers: (init.headers ?? {}) as Record<string, string>,
            body: init.body as string,
            signal,
          });
          return r as unknown as Response;
        } catch (e) {
          lastErr = e;
          // eslint-disable-next-line no-console
          console.log(`[agent-llm] attempt ${attempt + 1} failed: ${e instanceof Error ? e.message : String(e)}`);
          if (signal.aborted) throw new Error("cancelled");
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    };

    // Finish en UN appel : pas d'attente de confirmation (le 2e appel
    // sauté causait « no conclusion »). Le stream sans appel = relance UNE fois.
    let toolCalls = 0;
    // --- Réflecteur nudge-d'abord (style MobileUse/TTIR) ---
    // Détecte les patterns inutiles et FORCE une diversification au lieu de
    // tuer le run. Le kill (middleware revisite) n'est que le dernier recours.
    const STEP_BUDGET = 80;
    let lastFailKey = "";
    let failStreak = 0;
    let prevSig = "";
    let sigStreak = 0;
    let scrollOnlyStreak = 0;
    let scrollNudged = false;
    let pendingNudge: string | null = null;
    const takeNudge = (): string | null => {
      const n = pendingNudge;
      pendingNudge = null;
      return n;
    };
    const failKeyOf = (toolName: string, args: unknown): string => {
      try {
        const o = (args ?? {}) as Record<string, unknown>;
        const pick: Record<string, unknown> = { t: toolName };
        for (const k of ["id", "name", "text", "dir", "key"]) {
          if (o[k] !== undefined) pick[k] = o[k];
        }
        return JSON.stringify(pick);
      } catch {
        return toolName;
      }
    };
    const DIVERSIFY_NUDGE = (what: string): string =>
      `STOP repeating ${what}: it just failed identically. You MUST try something different NOW — scroll, tap a DIFFERENT id (use @top/@mid/@bot/@left/@right to disambiguate), press back, or open another app. Repeating it again will be refused without acting.`;
    const SCROLL_NUDGE =
      "You keep re-seeing the same screens by scrolling. STOP scrolling: re-read the tree, pick ONE precise element (id + @position suffix) and tap it, or press back. Scrolling again without acting is forbidden.";
    /** Refus déterministe (sans appel natif) dès la 4e répétition identique. */
    const claimRefusal = (toolName: string, args: unknown): string | null => {
      if (failStreak >= 3 && failKeyOf(toolName, args) === lastFailKey) {
        return `REFUSED without acting: ${toolName} ${JSON.stringify(args ?? {}).slice(0, 80)} already failed identically 3 times. Do something DIFFERENT now (scroll, different id with @position, back, another app).`;
      }
      return null;
    };
    const ACT_TOOLS = new Set(["tap", "type", "scroll", "open_app", "back", "swipe", "long_press"]);
    const LOOK_TOOLS = new Set(["scroll", "read_uitree", "take_screenshot"]);
    const trackTool = (tool: string, args: unknown, ok: boolean, error?: string, pkg?: string): void => {
      toolCalls += 1;
      // Filet large : fin honnête, jamais de jargon.
      if (toolCalls > STEP_BUDGET && !endRef.current) {
        endRef.current = {
          status: "failed",
          summary: `step budget exceeded (${STEP_BUDGET} actions without concluding) — task too long, split it and retry`,
        };
      }
      pushTrace(tool, args, ok, error, pkg);
      if (error === "refused-identical") return; // refus déterministe : hors compteurs
      // Pattern 1 : même action, même échec → directive au 3e tour.
      if (!ok && ACT_TOOLS.has(tool)) {
        const k = failKeyOf(tool, args);
        if (k === lastFailKey) failStreak += 1;
        else {
          failStreak = 1;
          lastFailKey = k;
        }
        if (failStreak === 2) {
          pendingNudge = DIVERSIFY_NUDGE(`${tool} ${JSON.stringify(args ?? {}).slice(0, 80)}`);
        }
      } else if (ok) {
        failStreak = 0;
        lastFailKey = "";
      }
      // Pattern 2 : mêmes écrans revus par regards seuls → nudge anti-scroll.
      if (lastSig) {
        if (lastSig === prevSig) {
          sigStreak += 1;
          if (LOOK_TOOLS.has(tool)) scrollOnlyStreak += 1;
          else scrollOnlyStreak = 0;
          if (sigStreak === 6 && scrollOnlyStreak >= 4 && !scrollNudged) {
            scrollNudged = true;
            pendingNudge = SCROLL_NUDGE;
          }
        } else {
          prevSig = lastSig;
          sigStreak = 0;
          scrollOnlyStreak = 0;
          scrollNudged = false;
        }
      }
    };

    const model = new OllamaAgentModel({
      model: MODEL,
      apiUrl: API_URL,
      key,
      fetchFn: fetchWithRetry as unknown as typeof fetch,
      timeoutMs: LLM_TIMEOUT_MS,
      signal,
      shotProvider: () => shots[1],
    });

    const tools = [
      ...createObserveTools({
        setShot: (shot) => {
          shots[0] = shots[1];
          shots[1] = shot;
        },
        noteScreen: (sig, pkg) => noteScreen(sig, pkg),
        onTrace: (tool, args, ok, error, pkg) => trackTool(tool, args, ok, error, pkg),
        onStep: (label, detail) => stepLine(label, detail),
        takeNudge: () => takeNudge(),
        setEnd: (status, summary) => {
          endRef.current = { status, summary };
        },
        isCancelled: () => cancelled || signal.aborted,
        verifyClaim: async (summary, evidence) => {
          const shot = shots[1];
          if (!shot || cancelled || signal.aborted) return null;
          const b64 = shot.includes(",") ? shot.split(",").slice(1).join(",") : shot;
          const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
          try {
            const res = await model.invoke([
              new SystemMessage(
                "You verify whether a phone task is visibly complete from a screenshot. " +
                'Reply with ONLY a JSON object: {"reached": true|false, "why": "short reason", "visible": "what is on screen regarding the goal"}. No other text.'
              ),
              new HumanMessage({
                content: [
                  { type: "text", text: `TASK: ${prompt}\nClaimed result: ${summary}\nEvidence claimed: ${evidence}\nIs the goal visibly achieved in the screenshot?` },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
                ],
              }),
            ]);
            const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
            const m = text.match(/\{[^{}]*\}/);
            if (!m) return null;
            const o = JSON.parse(m[0]) as Record<string, unknown>;
            if (typeof o["reached"] !== "boolean") return null;
            const v = {
              reached: o["reached"] as boolean,
              why: String(o["why"] ?? ""),
              visible: String(o["visible"] ?? ""),
            };
            // eslint-disable-next-line no-console
            console.log(`[agent-verify] reached=${v.reached} why=${v.why}`);
            recordTrace("verify", { summary: summary.slice(0, 80) }, v.reached, v.reached ? undefined : v.why);
            return v;
          } catch {
            return null;
          }
        },
      }),
      ...createActTools({
        refreshShot,
        noteScreen: (sig, pkg) => noteScreen(sig, pkg),
        onTrace: (tool, args, ok, error, pkg) => trackTool(tool, args, ok, error, pkg),
        onStep: (label, detail) => stepLine(label, detail),
        takeNudge: () => takeNudge(),
        claimRefusal: (tool, args) => claimRefusal(tool, args),
        isCancelled: () => cancelled || signal.aborted,
      }),
    ];

    try {
      try {
        stopHb();
        hb = window.setInterval(() => {
          ping().catch(() => {
            // ignore : le watchdog détectera le silence
          });
        }, 20000);
      } catch {
        // ignore
      }

      const agent = createAgent({
        model,
        tools,
        middleware: [
          // finish/ask (endRef posé par les tools) DOIT arrêter le graphe,
          // + détecteur de revisites en DERNIER recours (le nudge-d'abord
          // vit côté runner : trackTool/trackScreen ci-dessous).
          revisitMiddleware({
            getRunId: () => runId,
            getSig: () => lastSig,
            getEnd: () => endRef.current,
            onRevisitFail: () => recordTrace("stuck", {}, false, "returning to screens already seen"),
          }),
        ],
        checkpointer,
      });

      const config = {
        configurable: { thread_id: threadId },
        recursionLimit: RECURSION_LIMIT,
        signal,
      };
      const prior = (await agent.getState(config)) as unknown as {
        values?: { messages?: unknown[] };
      } | null;
      const hasHistory = !!prior?.values?.messages && (prior.values.messages as unknown[]).length > 0;

      const deadlineTimer = window.setTimeout(() => {
        deadlineHit = true;
        try {
          abort.abort();
        } catch {
          // ignore
        }
      }, RUN_DEADLINE_MS);

      try {
        // Tour 1 + éventuelle relance : un refus sec (zéro tool appelé)
        // repose la question UNE fois au lieu de mourir instantanément.
        for (let round = 0; round < 2; round += 1) {
          const isRetry = round === 1;
          const stream = await agent.stream(
            {
              messages: [
                ...(round === 0 ? [
                  ...(hasHistory ? [] : [new SystemMessage(SYSTEM_PROMPT)]),
                  new HumanMessage(`TASK: ${prompt}`),
                ] : [new HumanMessage("Call exactly one tool to start working on the task.")]),
              ],
            },
            { ...config, streamMode: "updates" }
          );
          for await (const rawChunk of stream as unknown as AsyncIterable<
            Record<string, { messages?: Array<{ tool_calls?: Array<{ name?: string; args?: Record<string, unknown> }> }> }>
          >) {
            if (cancelled || signal.aborted) return;
            try {
              const msgs = rawChunk["model"]?.messages;
              if (msgs && msgs.length > 0) {
                const last = msgs[msgs.length - 1];
                const tc = last?.tool_calls?.[0];
                const thought = tc?.args?.["thought"];
                const name = (tc as { name?: string } | undefined)?.name ?? "";
                if (typeof thought === "string" && thought.length > 0) {
                  stepLine(name ? `${name}…` : "thinking…", thought.slice(0, 400));
                }
              }
            } catch {
              // ignore : les tools loggent déjà leurs propres lignes
            }
          }
          if (cancelled || signal.aborted) return;
          if (toolCalls > 0 || endRef.current || isRetry) break;
          pushTrace("reminder", {}, true, "no tool called, asking once more");
        }
      } finally {
        window.clearTimeout(deadlineTimer);
      }
      if (cancelled || signal.aborted) {
        if (deadlineHit && !cancelled) {
          pushTrace("deadline", {}, false, "run deadline exceeded");
          endWith("failed", "run deadline exceeded");
        }
        return;
      }
      const done = endRef.current;
      if (done) {
        endWith(done.status, done.summary);
        return;
      }
      const finalState = (await agent.getState(config)) as unknown as {
        values?: {
          endReason?: { status?: unknown; summary?: unknown } | null;
          messages?: Array<{ content?: unknown }>;
        };
      } | null;
      // Canal middleware (revisite/stuck) : endReason d'état, ignoré avant.
      const se = finalState?.values?.endReason ?? null;
      if (se && (se.status === "success" || se.status === "failed") && typeof se.summary === "string") {
        endWith(se.status, se.summary);
        return;
      }
      const msgs = finalState?.values?.messages ?? [];
      // Repli : dernier texte MODÈLE uniquement (jamais un retour d'outil,
      // jamais TASK). Lit les strings ET les blocs multimodaux (gemma renvoie
      // des tableaux). Sans conclusion modèle → message générique.
      const modelText = (m: unknown): string | null => {
        if (!m || typeof m !== "object") return null;
        const o = m as Record<string, unknown>;
        let kind = "";
        try {
          const gt = o["getType"] ?? o["_getType"];
          if (typeof gt === "function") kind = String((gt as () => unknown).call(o) ?? "");
        } catch {
          kind = "";
        }
        if (!kind) kind = String(o["type"] ?? o["role"] ?? "");
        if (kind !== "ai" && kind !== "assistant" && kind !== "AIMessage") return null;
        const c = o["content"];
        if (typeof c === "string") return c.trim().length > 0 ? c : null;
        if (Array.isArray(c)) {
          const t = c
            .map((b) => {
              if (typeof b === "string") return b;
              if (b && typeof b === "object") {
                const r = b as Record<string, unknown>;
                return typeof r["text"] === "string" ? (r["text"] as string) : "";
              }
              return "";
            })
            .join(" ")
            .trim();
          return t.length > 0 ? t : null;
        }
        return null;
      };
      const lastText = [...msgs].map(modelText).reverse()
        .find((t): t is string => t !== null) ?? "no conclusion produced";
      endWith("failed", lastText.slice(0, 300));
    } catch (e) {
      if (cancelled || signal.aborted) {
        if (deadlineHit && !cancelled) {
          pushTrace("deadline", {}, false, "run deadline exceeded");
          endWith("failed", "run deadline exceeded");
        }
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (/recursion/i.test(msg)) {
        pushTrace("recursion", {}, false, msg.slice(0, 120));
        endWith("failed", "recursion limit exceeded");
        return;
      }
      const { friendlyLlmError } = await import("./ollamaKey");
      cb.onError(friendlyLlmError(msg));
    }
  })();

  return { cancel };
}
