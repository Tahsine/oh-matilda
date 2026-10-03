// Phase 2 : UNE action (tap). Après chaque tap, screenshot auto pour que
// la prochaine vue corresponde au nouvel écran (observe-first).
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { openApp, scroll, tap, typeText } from "./agentTools";

export interface ActCtx {
  refreshShot: () => Promise<void>;
  noteScreen: (sig: string, pkg: string) => void;
  onTrace: (tool: string, args: unknown, ok: boolean, error?: string, pkg?: string) => void;
  onStep: (label: string, detail: string) => void;
  isCancelled: () => boolean;
}

export function createActTools(ctx: ActCtx) {
  const tapEl = tool(
    async ({ thought, id }: { thought: string; id: number }) => {
      ctx.onStep(`tap [${id}]`, thought.slice(0, 400));
      try {
        const res = await tap(Number(id));
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("tap", { id }, false, res.error ?? res.code ?? "?");
          return `Tap failed (${res.error ?? res.code ?? "?"}). Look at the fresh screenshot and tree, then try something else.`;
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("tap", { id }, true);
        return "Tap done. A fresh screenshot is attached to your next view: check what changed, then continue.";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("tap", { id }, false, msg);
        return `Tap failed (${msg}).`;
      }
    },
    {
      name: "tap",
      description: "Tap an element by id from the current screen (buttons, inputs, text links, images). After the tap you automatically get a fresh screenshot: check what changed.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: what you see, why this element, what you expect"),
        id: z.number().describe("element id from the CURRENT tree (never reuse an old id)"),
      }),
    }
  );

  const openAppEl = tool(
    async ({ thought, name }: { thought: string; name: string }) => {
      ctx.onStep(`open ${name}`, thought.slice(0, 400));
      try {
        const res = await openApp(name);
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("open_app", { name }, false, res.error ?? res.code ?? "?");
          return `Open failed (${res.error ?? res.code ?? "?"}). Try another name or continue observing.`;
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("open_app", { name }, true);
        return "App opened. A fresh screenshot is attached to your next view: check where you are, then continue.";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("open_app", { name }, false, msg);
        return `Open failed (${msg}).`;
      }
    },
    {
      name: "open_app",
      description: "Leave the current app and open another by name (e.g. Chrome, YouTube). Some system and financial apps are blocked. This is how you exit the Oh-Matilda app itself.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: where you are, why this app, what you expect"),
        name: z.string().describe("app name"),
      }),
    }
  );

  const typeEl = tool(
    async ({ thought, id, text, submit }: {
      thought: string; id: number; text: string; submit?: boolean;
    }) => {
      const sub = submit === true;
      ctx.onStep(`type [${id}]${sub ? " + submit" : ""}`, thought.slice(0, 400));
      try {
        const res = await typeText(Number(id), String(text ?? ""), sub, false);
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("type", { id, submit: sub }, false, res.error ?? res.code ?? "?");
          return `Type failed (${res.error ?? res.code ?? "?"}). Look at the fresh screenshot and tree, then try something else.`;
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("type", { id, submit: sub }, true);
        return "Text entered. A fresh screenshot is attached to your next view: check what changed, then continue.";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("type", { id }, false, msg);
        return `Type failed (${msg}).`;
      }
    },
    {
      name: "type",
      description: "Type text into an input by id. submit=true presses Enter/Search/Go afterwards.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: which field, what text, what you expect"),
        id: z.number().describe("input id from the CURRENT tree"),
        text: z.string().describe("text to enter"),
        submit: z.boolean().optional().describe("validate after typing"),
      }),
    }
  );

  const scrollEl = tool(
    async ({ thought, id, dir }: { thought: string; id: number; dir: string }) => {
      ctx.onStep(`scroll [${id}] ${dir}`, thought.slice(0, 400));
      try {
        const res = await scroll(Number(id), String(dir ?? "down"));
        if (ctx.isCancelled()) return "Cancelled.";
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (!res.ok) {
          ctx.onTrace("scroll", { id, dir }, false, res.error ?? res.code ?? "?");
          return `Scroll failed (${res.error ?? res.code ?? "?"}). Look at the fresh screenshot and tree, then try something else.`;
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("scroll", { id, dir }, true);
        return "Scrolled. A fresh screenshot is attached to your next view: check what changed, then continue.";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("scroll", { id, dir }, false, msg);
        return `Scroll failed (${msg}).`;
      }
    },
    {
      name: "scroll",
      description: "Scroll a scrollable list by id (marked ↓/↑). Use it when the page is cut off and what you seek may be below. Reports end of list.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: what list, which direction, what you expect"),
        id: z.number().describe("scrollable element id from the CURRENT tree"),
        dir: z.enum(["up", "down", "left", "right"]),
      }),
    }
  );

  return [tapEl, openAppEl, typeEl, scrollEl];
}
