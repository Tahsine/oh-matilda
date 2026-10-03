// Les 3 tools de la phase perception : observer, pas agir.
// take_screenshot : capture MediaProjection, jointe à la prochaine vue.
// read_uitree : arbre UiReader frais (texte). finish : conclure soi-même.
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { observe } from "./agentTools";
import { requestAgentScreenshot } from "./agentBridge";

export interface ObserveCtx {
  setShot: (shot: string | null) => void;
  noteScreen: (sig: string, pkg: string) => void;
  onTrace: (tool: string, args: unknown, ok: boolean, error?: string, pkg?: string) => void;
  onStep: (label: string, detail: string) => void;
  setEnd: (status: "success" | "failed", summary: string) => void;
  isCancelled: () => boolean;
  /** true au 2e finish consécutif (le 1er déclenche une re-lecture). */
  claimFinishConfirm: () => boolean;
  /** Annule l'attente de confirmation (rejet du vérificateur). */
  resetFinishPending: () => void;
  /** Second avis visuel sur un finish(success). null = panne, on autorise. */
  verifyClaim: (summary: string, evidence: string) => Promise<{ reached: boolean; why: string; visible: string } | null>;
}

const thoughtField = (what: string) =>
  z.string().describe(
    `1-3 sentences: what you see now, how it compares to the goal, and why you choose ${what}`
  );

const SHOT_TIMEOUT_MS = 15000;

export function createObserveTools(ctx: ObserveCtx) {
  const takeScreenshot = tool(
    async ({ thought }: { thought: string }) => {
      ctx.onStep("screenshot", thought.slice(0, 400));
      try {
        const shot: string = await Promise.race([
          requestAgentScreenshot(),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("shot timeout")), SHOT_TIMEOUT_MS);
          }),
        ]);
        if (ctx.isCancelled()) return "Cancelled.";
        if (shot) {
          ctx.setShot(shot);
          ctx.onTrace("take_screenshot", {}, true);
          return "Screenshot captured and attached to your next view. Describe what you see on it.";
        }
        ctx.setShot(null);
        ctx.onTrace("take_screenshot", {}, false, "empty shot");
        return "Screenshot unavailable, continue with the text tree.";
      } catch (e) {
        ctx.setShot(null);
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("take_screenshot", {}, false, msg);
        return `Screenshot failed (${msg}), continue with the text tree.`;
      }
    },
    {
      name: "take_screenshot",
      description: "Capture the current phone screen. The image is attached to your next view: use it to understand layout and what is really visible.",
      schema: z.object({ thought: thoughtField("this screenshot") }),
    }
  );

  const readUitree = tool(
    async ({ thought }: { thought: string }) => {
      ctx.onStep("read tree", thought.slice(0, 400));
      try {
        const res = await observe();
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok || !res.screen) {
          ctx.onTrace("read_uitree", {}, false, res.error ?? res.code ?? "no screen");
          return `Tree read failed (${res.error ?? res.code ?? "?"}).`;
        }
        ctx.noteScreen(res.screen.sig, res.screen.pkg);
        ctx.onTrace("read_uitree", {}, true, undefined, res.screen.pkg);
        return `CURRENT TREE:\n${res.screen.text}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("read_uitree", {}, false, msg);
        return `Tree read failed (${msg}).`;
      }
    },
    {
      name: "read_uitree",
      description: "Read the current screen as an accessibility tree (ids, roles, labels, states). Use it to choose the id your next action would take.",
      schema: z.object({ thought: thoughtField("this reading") }),
    }
  );

  const finish = tool(
    async ({ thought, status, summary, evidence }: {
      thought: string; status: string; summary: string; evidence?: string;
    }) => {
      ctx.onStep("task done", `${thought} — ${summary}`.slice(0, 400));
      if (status !== "success" && status !== "failed") {
        ctx.onTrace("finish", { status, summary }, false, "bad finish status");
        return "Invalid finish: status must be success or failed. Keep observing or finish correctly.";
      }
      ctx.onTrace("finish", { status, summary, evidence: evidence ?? "" }, true);
      // Finish en deux temps : le 1er ne termine pas, il impose un second
      // regard (screenshot + arbre frais rendus). Le 2e consécutif conclut.
      // Sans ça, le graphe se coupe sur une conclusion non vérifiée (bluff).
      if (!ctx.claimFinishConfirm()) {
        ctx.onStep("verify before finish", "fresh look required");
        let fresh = "";
        try {
          const shot: string = await Promise.race([
            requestAgentScreenshot(),
            new Promise<never>((_, reject) => {
              window.setTimeout(() => reject(new Error("shot timeout")), SHOT_TIMEOUT_MS);
            }),
          ]);
          if (!ctx.isCancelled() && shot) {
            ctx.setShot(shot);
            fresh += "Fresh screenshot attached. ";
          }
        } catch {
          // ignore : arbre seul
        }
        try {
          const res = await observe();
          if (!ctx.isCancelled() && res.ok && res.screen) {
            ctx.noteScreen(res.screen.sig, res.screen.pkg);
            fresh += `Fresh tree:\n${res.screen.text}`;
          }
        } catch {
          // ignore
        }
        return `NOT finished yet. Look again (fresh view below) and call finish a SECOND time to confirm — same status, updated summary/evidence if needed.\n${fresh}`;
      }
      // Sas anti-bluff (réversible) : second avis visuel sur success.
      // Rejeté → pas de fin, le modèle continue (ou échoue honnêtement).
      // Panne (pas de capture/réseau/illisible) → on autorise.
      if (status === "success") {
        let verdict: { reached: boolean; why: string; visible: string } | null = null;
        try {
          verdict = await ctx.verifyClaim(summary, evidence ?? "");
        } catch {
          verdict = null;
        }
        if (ctx.isCancelled()) return "Cancelled.";
        if (verdict && !verdict.reached) {
          ctx.resetFinishPending();
          ctx.onStep("visual check", `rejected: ${verdict.why}`.slice(0, 400));
          ctx.onTrace("finish", { status, summary }, false, `visual check failed: ${verdict.why}`);
          return (
            `Visual check failed: ${verdict.why || "goal not visible"} ` +
            `(visible: ${(verdict.visible || "?").slice(0, 200)}). ` +
            `Keep going: act again to truly achieve the goal, or finish(failed) if it is impossible.`
          );
        }
      }
      ctx.setEnd(status === "success" ? "success" : "failed", summary);
      return `OK · concluding with ${status}.`;
    },
    {
      name: "finish",
      description: "Conclude: success if you understand the screen and the full path to the goal, failed if it looks impossible. If information is missing, explain it in a failed summary.",
      schema: z.object({
        thought: thoughtField("concluding now"),
        status: z.enum(["success", "failed"]),
        summary: z.string().describe("short conclusion: what you understood and what you would do"),
        evidence: z.string().optional().describe("what on the current screenshot proves it"),
      }),
    }
  );

  return [takeScreenshot, readUitree, finish];
}
