// Garde-fous minimaux du graphe (mécanique prouvée spike S2).
// Revisites : DERNIER recours uniquement. Le nudge-d'abord vit côté
// runner (trackTool : diversification forcée après 2 échecs identiques,
// nudge anti-scroll à 6 écrans revus). Ici on ne tue qu'à 14 : un run
// légitime qui chasse (scrolls aller-retour) ne doit pas mourir à 6.
import { createMiddleware } from "langchain";
import { z } from "zod";

export interface EndState {
  status: "success" | "failed";
  summary: string;
}

export interface RevisitCtl {
  getRunId: () => string;
  getSig: () => string;
  getEnd: () => EndState | null;
  onRevisitFail: () => void;
}

export const REVISIT_FAIL_AT = 14;
const SEEN_CAP = 40;

const schema = z.object({
  runId: z.string().default(""),
  seenSigs: z.array(z.string()).default([]),
  revisitCount: z.number().default(0),
  endReason: z.object({ status: z.string(), summary: z.string() }).nullable().default(null),
});

type S = { seenSigs?: string[]; revisitCount?: number };

export function revisitMiddleware(ctl: RevisitCtl) {
  return createMiddleware({
    name: "revisit",
    stateSchema: schema,
    beforeAgent: {
      hook: () => ({
        runId: ctl.getRunId(),
        seenSigs: [],
        revisitCount: 0,
        endReason: null,
      }),
    },
    beforeModel: {
      hook: (state: S) => {
        const end = ctl.getEnd();
        if (end) {
          return { endReason: end, jumpTo: "end" as const };
        }
        const sig = ctl.getSig();
        const seen = state.seenSigs ?? [];
        const count = state.revisitCount ?? 0;
        if (sig && seen.includes(sig)) {
          const n = count + 1;
          if (n >= REVISIT_FAIL_AT) {
            ctl.onRevisitFail();
            return {
              seenSigs: seen,
              revisitCount: n,
              endReason: { status: "failed", summary: "stuck: returning to screens already seen" },
              jumpTo: "end" as const,
            };
          }
          return { seenSigs: seen, revisitCount: n };
        }
        return {
          seenSigs: sig ? [...seen, sig].slice(-SEEN_CAP) : seen,
          revisitCount: 0,
        };
      },
      canJumpTo: ["end"],
    },
  });
}
