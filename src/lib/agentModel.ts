// Adapteur modèle LangChain ↔ Ollama Cloud (spike S0).
// Délègue le HTTP à un fetch injecté (global fetch hors device,
// tauriFetch en WebView : contourne CORS). Convertit messages LangChain
// ↔ wire Ollama /api/chat (system/user/assistant+tool_calls/tool,
// blocs image_url → images[] base64 sans préfixe).
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { RunnableLambda } from "@langchain/core/runnables";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

export interface WireMsg {
  role: string;
  content?: string;
  images?: string[];
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
  tool_name?: string;
}

interface WireToolDef {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}

export interface AgentModelOpts {
  model: string;
  apiUrl: string;
  key: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Annulation du run (combine avec le timeout). */
  signal?: AbortSignal;
  /** Capture courante (rattachée au message écran, jamais persistée). */
  shotProvider?: () => string | null;
}

type AnyTool = {
  name: string;
  description?: string;
  schema?: unknown;
};

function toolToParams(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return { type: "object" };
  const s = schema as Record<string, unknown>;
  // Schéma JSON déjà prêt (pas zod) : passage direct.
  if (!("_def" in s)) return s;
  try {
    return toJsonSchema(s as never) as unknown as Record<string, unknown>;
  } catch {
    return { type: "object" };
  }
}

function lcToolsToWire(tools: AnyTool[] | undefined): WireToolDef[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: toolToParams(t.schema),
    },
  }));
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && typeof b === "object" && (b as { type?: string }).type === "text")
      .map((b) => String((b as { text?: unknown }).text ?? ""))
      .join("");
  }
  return "";
}

function imagesOf(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) return undefined;
  const out: string[] = [];
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    const blk = b as { type?: string; image_url?: unknown };
    if (blk.type !== "image_url") continue;
    const iu = blk.image_url;
    const url = typeof iu === "string" ? iu : (iu as { url?: unknown })?.url;
    if (typeof url !== "string" || url.length === 0) continue;
    out.push(url.includes(",") ? url.split(",").slice(1).join(",") : url);
  }
  return out.length > 0 ? out : undefined;
}

export function lcToWire(messages: BaseMessage[]): WireMsg[] {
  return messages.map((m) => {
    const type = m.getType();
    if (type === "system") return { role: "system", content: textOf(m.content) };
    if (type === "human") {
      const w: WireMsg = { role: "user", content: textOf(m.content) };
      const imgs = imagesOf(m.content);
      if (imgs) w.images = imgs;
      return w;
    }
    if (type === "ai") {
      const ai = m as AIMessage;
      const w: WireMsg = { role: "assistant", content: textOf(m.content) };
      const tcs = (ai.tool_calls ?? []) as Array<{ name?: string; args?: unknown }>;
      if (tcs.length > 0) {
        w.tool_calls = tcs.map((tc) => ({
          function: {
            name: String(tc.name ?? ""),
            arguments: (tc.args && typeof tc.args === "object" ? tc.args : {}) as Record<string, unknown>,
          },
        }));
      }
      return w;
    }
    if (type === "tool") {
      const tm = m as unknown as { tool_call_id?: string; name?: string };
      const w: WireMsg = { role: "tool", content: textOf(m.content) };
      if (tm.name) w.tool_name = tm.name;
      else if (tm.tool_call_id) w.tool_name = tm.tool_call_id;
      return w;
    }
    return { role: "user", content: textOf(m.content) };
  });
}

export class OllamaAgentModel extends BaseChatModel<BaseChatModelCallOptions> {
  private opts: AgentModelOpts;

  constructor(opts: AgentModelOpts) {
    super({});
    this.opts = opts;
  }

  _llmType(): string {
    return "ollama-agent";
  }

  bindTools(tools: AnyTool[], _kwargs?: Partial<BaseChatModelCallOptions>) {
    const self = this;
    return RunnableLambda.from(async (input: BaseLanguageModelInput) => {
      return self.invoke(input, { tools } as never);
    }) as never;
  }

  async _generate(
    messages: BaseMessage[],
    options: Partial<BaseChatModelCallOptions> & { tools?: AnyTool[] },
    _runManager?: unknown
  ): Promise<ChatResult> {
    const f = this.opts.fetchFn ?? fetch;
    const wire = lcToWire(messages);
    // Screenshot transitoire : message image hors état (jamais checkpointé).
    try {
      const shot = this.opts.shotProvider?.();
      if (shot) {
        const b64 = shot.includes(",") ? shot.split(",").slice(1).join(",") : shot;
        wire.push({ role: "user", content: "CURRENT SCREEN (screenshot):", images: [b64] });
      }
    } catch {
      // ignore : tour texte seul
    }
    const body: Record<string, unknown> = {
      model: this.opts.model,
      messages: wire,
      stream: false,
    };
    const wireTools = lcToolsToWire(options?.tools);
    if (wireTools) body["tools"] = wireTools;
    // eslint-disable-next-line no-console
    console.log(`[agent-llm] decide start msgs=${wire.length}${wireTools ? ` tools=${wireTools.length}` : ""}`);
    const t0 = Date.now();
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => {
      try { timeoutCtrl.abort(); } catch { /* ignore */ }
    }, this.opts.timeoutMs ?? 45000);
    const combined = this.opts.signal
      ? AbortSignal.any([this.opts.signal, timeoutCtrl.signal])
      : timeoutCtrl.signal;
    try {
      const resp = await f(this.opts.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.key}`,
        },
        body: JSON.stringify(body),
        signal: combined,
      });
      if (!resp.ok) throw new Error(`LLM http ${resp.status}`);
      const data = (await resp.json()) as {
        message?: {
          content?: string;
          tool_calls?: Array<{ function?: { name?: string; arguments?: unknown }; id?: string }>;
        };
      };
      const msg = data.message ?? {};
      const rawTcs = msg.tool_calls ?? [];
      // eslint-disable-next-line no-console
      console.log(`[agent-llm] decide end ok ${Date.now() - t0}ms calls=${rawTcs.length}`);
      const toolCalls = rawTcs
        .filter((tc) => tc?.function?.name)
        .map((tc, i) => {
          let args: Record<string, unknown> = {};
          const a = tc.function?.arguments;
          if (typeof a === "string") {
            try { args = JSON.parse(a) as Record<string, unknown>; } catch { args = {}; }
          } else if (a && typeof a === "object") {
            args = a as Record<string, unknown>;
          }
          return {
            id: tc.id ?? `call_${Date.now()}_${i}`,
            name: String(tc.function?.name ?? ""),
            args,
            type: "tool_call" as const,
          };
        });
      const text = msg.content ?? "";
      const message = new AIMessage({ content: text, tool_calls: toolCalls });
      return { generations: [{ text, message }] };
    } finally {
      clearTimeout(timer);
    }
  }
}
