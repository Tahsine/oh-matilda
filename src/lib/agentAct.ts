// Phase 2 : UNE action (tap). Après chaque tap, screenshot auto pour que
// la prochaine vue corresponde au nouvel écran (observe-first).
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { longPress, openApp, press, scroll, swipe, tap, typeText } from "./agentTools";

export interface ActCtx {
  refreshShot: () => Promise<void>;
  noteScreen: (sig: string, pkg: string) => void;
  onTrace: (tool: string, args: unknown, ok: boolean, error?: string, pkg?: string) => void;
  onStep: (label: string, detail: string) => void;
  isCancelled: () => boolean;
  /** Nudge du réflecteur (diversification forcée), consommé une fois. */
  takeNudge: () => string | null;
  /** Refus déterministe dès la 4e répétition identique (texte ou null). */
  claimRefusal: (tool: string, args: unknown) => string | null;
}

export function createActTools(ctx: ActCtx) {
  // Nudge en suffixe de résultat (tour suivant la détection).
  const nz = (): string => {
    const n = ctx.takeNudge();
    return n ? `\n\nNUDGE: ${n}` : "";
  };
  // Refus sec sans appel natif (ne brûle ni temps ni quota).
  const refused = (toolName: string, args: unknown): string | null => {
    const r = ctx.claimRefusal(toolName, args);
    if (r) ctx.onTrace(toolName, args, false, "refused-identical");
    return r;
  };
  const tapEl = tool(
    async ({ thought, id }: { thought: string; id: number }) => {
      ctx.onStep(`tap [${id}]`, thought.slice(0, 400));
      const ref = refused("tap", { id });
      if (ref) return ref;
      try {
        const res = await tap(Number(id));
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("tap", { id }, false, res.error ?? res.code ?? "?");
          return `Tap failed (${res.error ?? res.code ?? "?"}). Look at the fresh screenshot and tree, then try something else.` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("tap", { id }, true);
        return "Tap done. A fresh screenshot is attached to your next view: check what changed, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("tap", { id }, false, msg);
        return `Tap failed (${msg}).` + nz();
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
      const refOpen = refused("open_app", { name });
      if (refOpen) return refOpen;
      try {
        const res = await openApp(name);
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("open_app", { name }, false, res.error ?? res.code ?? "?");
          return `Open failed (${res.error ?? res.code ?? "?"}). Try another name or continue observing.` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("open_app", { name }, true);
        return "App opened. A fresh screenshot is attached to your next view: check where you are, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("open_app", { name }, false, msg);
        return `Open failed (${msg}).` + nz();
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
      const refType = refused("type", { id, text, submit: sub });
      if (refType) return refType;
      try {
        const res = await typeText(Number(id), String(text ?? ""), sub, false);
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("type", { id, submit: sub }, false, res.error ?? res.code ?? "?");
          return `Type failed (${res.error ?? res.code ?? "?"}). Look at the fresh screenshot and tree, then try something else.` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("type", { id, submit: sub }, true);
        return "Text entered. A fresh screenshot is attached to your next view: check what changed, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("type", { id }, false, msg);
        return `Type failed (${msg}).` + nz();
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
      const refScroll = refused("scroll", { id, dir });
      if (refScroll) return refScroll;
      try {
        const res = await scroll(Number(id), String(dir ?? "down"));
        if (ctx.isCancelled()) return "Cancelled.";
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (!res.ok) {
          ctx.onTrace("scroll", { id, dir }, false, res.error ?? res.code ?? "?");
          return `Scroll failed (${res.error ?? res.code ?? "?"}). Look at the fresh screenshot and tree, then try something else.` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("scroll", { id, dir }, true);
        return "Scrolled. A fresh screenshot is attached to your next view: check what changed, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("scroll", { id, dir }, false, msg);
        return `Scroll failed (${msg}).` + nz();
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

  const backEl = tool(
    async ({ thought }: { thought: string }) => {
      ctx.onStep("back", thought.slice(0, 400));
      try {
        const res = await press("back");
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("back", {}, false, res.error ?? res.code ?? "?");
          return `Back failed (${res.error ?? res.code ?? "?"}).` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("back", {}, true);
        return "Went back. A fresh screenshot is attached to your next view: check where you are, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("back", {}, false, msg);
        return `Back failed (${msg}).` + nz();
      }
    },
    {
      name: "back",
      description: "Press the system Back button: dismiss a dialog or the keyboard, leave the current screen, retreat from a dead end. Use it instead of repeating a failing tap.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: why retreating, what you expect to see"),
      }),
    }
  );

  const DIST_PX: Record<string, number> = { short: 300, medium: 600, long: 1000 };
  const swipeEl = tool(
    async ({ thought, dir, dist }: { thought: string; dir: string; dist?: string }) => {
      const d = String(dir ?? "down");
      const px = DIST_PX[String(dist ?? "medium")] ?? 600;
      ctx.onStep(`swipe ${d}`, thought.slice(0, 400));
      const refSwipe = refused("swipe", { dir: d, dist });
      if (refSwipe) return refSwipe;
      try {
        const res = await swipe(d, px);
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("swipe", { dir: d }, false, res.error ?? res.code ?? "?");
          return `Swipe failed (${res.error ?? res.code ?? "?"}).` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("swipe", { dir: d }, true);
        return "Swiped. A fresh screenshot is attached to your next view: check what changed, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("swipe", { dir: d }, false, msg);
        return `Swipe failed (${msg}).` + nz();
      }
    },
    {
      name: "swipe",
      description: "Free swipe gesture (screen center) when no scrollable id fits: dismiss, carousel, free scroll. Prefer scroll(id) inside lists.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: why a free swipe, which direction, what you expect"),
        dir: z.enum(["up", "down", "left", "right"]),
        dist: z.enum(["short", "medium", "long"]).optional().describe("swipe length"),
      }),
    }
  );

  const longPressEl = tool(
    async ({ thought, id }: { thought: string; id: number }) => {
      ctx.onStep(`long-press [${id}]`, thought.slice(0, 400));
      const refLp = refused("long_press", { id });
      if (refLp) return refLp;
      try {
        const res = await longPress(Number(id));
        if (res.screen) ctx.noteScreen(res.screen.sig, res.screen.pkg);
        if (ctx.isCancelled()) return "Cancelled.";
        if (!res.ok) {
          ctx.onTrace("long_press", { id }, false, res.error ?? res.code ?? "?");
          return `Long press failed (${res.error ?? res.code ?? "?"}).` + nz();
        }
        await ctx.refreshShot();
        if (ctx.isCancelled()) return "Cancelled.";
        ctx.onTrace("long_press", { id }, true);
        return "Long press done. A fresh screenshot is attached to your next view: check what changed, then continue." + nz();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.onTrace("long_press", { id }, false, msg);
        return `Long press failed (${msg}).` + nz();
      }
    },
    {
      name: "long_press",
      description: "Long-press an element by id: context menus, selection, drag handles. Use sparingly, only when a tap is not enough.",
      schema: z.object({
        thought: z.string().describe("1-3 sentences: which element, why long-press, what you expect"),
        id: z.number().describe("element id from the CURRENT tree"),
      }),
    }
  );

  return [tapEl, openAppEl, typeEl, scrollEl, backEl, swipeEl, longPressEl];
}
