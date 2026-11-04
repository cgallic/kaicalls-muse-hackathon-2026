import type { ZodType } from "zod";
import { memoryExtractionSchema, type MemoryExtractionResult } from "./types";

export type MuseProfile = { model: string; endpoint: string; apiKey: string };
export type MuseMessages = Array<{ role: "system" | "user"; content: string }>;
export type MuseStructuredResult<T> = {
  status: "ok" | "unconfigured" | "timeout" | "error" | "invalid";
  output?: T;
  requestId?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  responseModel?: string;
  costUsd?: number;
};
export type MuseResult = MuseStructuredResult<MemoryExtractionResult>;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** No catalog lookup or implicit model. Credentials never follow a changed endpoint. */
export function getMuseMemoryProfile(): MuseProfile {
  const endpoint = process.env.MUSE_MEMORY_ENDPOINT || OPENROUTER_ENDPOINT;
  return {
    model: process.env.MUSE_MEMORY_MODEL?.trim() || "",
    endpoint,
    apiKey: process.env.MUSE_MEMORY_API_KEY ||
      (endpoint === OPENROUTER_ENDPOINT ? process.env.OPENROUTER_API_KEY || "" : ""),
  };
}

/** One bounded attempt, no retries. A local timeout is NOT a provider billing cutoff. */
export async function museMemoryCompletion(
  profile: MuseProfile,
  messages: MuseMessages,
  options: { fetcher?: typeof fetch; timeoutMs?: number; maxTokens?: number; reasoningEffort?: "minimal" } = {},
): Promise<MuseResult> {
  return museStructuredCompletion(profile, messages, memoryExtractionSchema as ZodType<MemoryExtractionResult>,
    ["new_facts", "reinforcements", "contradictions", "goal", "open_loops"], options);
}

/** Shared bounded transport; the caller supplies the complete response contract. */
export async function museStructuredCompletion<T>(
  profile: MuseProfile,
  messages: MuseMessages,
  schema: ZodType<T>,
  requiredKeys: string[],
  options: { fetcher?: typeof fetch; timeoutMs?: number; maxTokens?: number; reasoningEffort?: "minimal" } = {},
): Promise<MuseStructuredResult<T>> {
  if (!profile.apiKey || !profile.model || !profile.endpoint) return { status: "unconfigured" };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = async (): Promise<MuseStructuredResult<T>> => {
    try {
      const response = await (options.fetcher || fetch)(profile.endpoint, {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${profile.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: profile.model, messages, max_tokens: options.maxTokens ?? 4096,
          ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
          response_format: { type: "json_object" } }),
      });
      if (!response.ok) return { status: "error" };
      const data = await response.json();
      const details = {
        requestId: typeof data.id === "string" ? data.id.slice(0, 128) : undefined,
        promptTokens: numericUsage(data.usage?.prompt_tokens),
        completionTokens: numericUsage(data.usage?.completion_tokens),
        reasoningTokens: numericUsage(data.usage?.completion_tokens_details?.reasoning_tokens),
        responseModel: typeof data.model === "string" ? data.model.slice(0, 128) : undefined,
        costUsd: numericUsage(data.usage?.cost),
      };
      const choice = data.choices?.[0];
      if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") {
        return { status: "invalid", ...details };
      }
      let parsed: unknown;
      try { parsed = JSON.parse(choice.message.content); }
      catch { return { status: "invalid", ...details }; }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "invalid", ...details };
      // Defaults in the incumbent schema must not turn incomplete JSON into evidence.
      if (!requiredKeys.every(key => Object.prototype.hasOwnProperty.call(parsed, key))) {
        return { status: "invalid", ...details };
      }
      const validated = schema.safeParse(parsed);
      return validated.success
        ? { status: "ok", output: validated.data, ...details }
        : { status: "invalid", ...details };
    } catch {
      return { status: controller.signal.aborted ? "timeout" : "error" };
    }
  };
  try {
    // Bound even response-body parsing or a transport that ignores AbortSignal.
    return await Promise.race([attempt(), new Promise<MuseStructuredResult<T>>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve({ status: "timeout" }); },
        options.timeoutMs ?? 3000);
    })]);
  } catch {
    return { status: "error" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function numericUsage(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
