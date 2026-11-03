import { afterEach, describe, expect, it, vi } from "vitest";
import { getMuseMemoryProfile, museMemoryCompletion } from "./museClient";
import { logMuseExtractionShadow } from "./museShadow";
import { resolveMuseMemoryShadowGate } from "./museGate";
import { isMuseMemoryShadowEnabled } from "./memoryFlags";
import { memoryExtractionSchema, type CallerMemoryFact } from "./types";

const profile = { model: "meta/muse-wonder", endpoint: "https://provider.invalid/chat/completions", apiKey: "fixture-key" };
const empty = memoryExtractionSchema.parse({});
const messages = [{ role: "user" as const, content: "SYNTHETIC caller prefers mornings" }];
function completion(content: unknown = empty, finish = "stop") {
  return new Response(JSON.stringify({ id: "fixture-request", usage: { prompt_tokens: 10, completion_tokens: 20,
    completion_tokens_details: { reasoning_tokens: 15 } },
    choices: [{ finish_reason: finish, message: { content: JSON.stringify(content) } }] }));
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Muse opt-in gate", () => {
  const input = { flagEnabled: true, businessId: "staged-A", stagedBusinessId: "staged-A", businessOptIn: true, memoryMode: "full" };
  it.each([undefined, "", "false", "off", "1", "TRUE"])("defaults OFF for %s", value => {
    vi.stubEnv("MUSE_MEMORY_SHADOW_ENABLED", value);
    expect(isMuseMemoryShadowEnabled()).toBe(false);
  });
  it("requires all independent gates and exact staged identity", () => {
    expect(resolveMuseMemoryShadowGate(input)).toBe(true);
    for (const override of [{ flagEnabled: false }, { businessOptIn: "true" }, { businessOptIn: undefined },
      { stagedBusinessId: undefined }, { businessId: "business-B" }, { memoryMode: "off" }, { memoryMode: "unknown" }]) {
      expect(resolveMuseMemoryShadowGate({ ...input, ...override })).toBe(false);
    }
  });
});

describe("shared Muse transport (mock HTTP only)", () => {
  it("leaves the model unconfigured and makes no request until explicitly supplied", async () => {
    vi.stubEnv("MUSE_MEMORY_MODEL", "");
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-router-key");
    const fetcher = vi.fn();
    const configured = getMuseMemoryProfile();
    expect(configured.model).toBe("");
    expect((await museMemoryCompletion(configured, messages, { fetcher })).status).toBe("unconfigured");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("never forwards the incumbent key to a custom endpoint", async () => {
    vi.stubEnv("MUSE_MEMORY_MODEL", "fixture-model");
    vi.stubEnv("MUSE_MEMORY_ENDPOINT", "https://custom-provider.invalid/chat/completions");
    vi.stubEnv("MUSE_MEMORY_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "incumbent-router-key");
    const fetcher = vi.fn();
    const configured = getMuseMemoryProfile();
    expect(configured.apiKey).toBe("");
    expect((await museMemoryCompletion(configured, messages, { fetcher })).status).toBe("unconfigured");
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("MUSE_MEMORY_API_KEY", "dedicated-key");
    expect(getMuseMemoryProfile().apiKey).toBe("dedicated-key");
  });
  it("allows the incumbent key only at the exact default OpenRouter endpoint", () => {
    vi.stubEnv("MUSE_MEMORY_ENDPOINT", "");
    vi.stubEnv("MUSE_MEMORY_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-router-key");
    expect(getMuseMemoryProfile().apiKey).toBe("fixture-router-key");
    vi.stubEnv("MUSE_MEMORY_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions/");
    expect(getMuseMemoryProfile().apiKey).toBe("");
  });
  it("does no egress without a key", async () => {
    const fetcher = vi.fn();
    expect((await museMemoryCompletion({ ...profile, apiKey: "" }, messages, { fetcher })).status).toBe("unconfigured");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("supports profile substitution, validates output and captures usage", async () => {
    const fetcher = vi.fn().mockResolvedValue(completion());
    const result = await museMemoryCompletion(profile, messages, { fetcher });
    expect(result).toMatchObject({ status: "ok", output: empty, requestId: "fixture-request", reasoningTokens: 15 });
    expect(fetcher.mock.calls[0][0]).toBe(profile.endpoint);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ model: profile.model, max_tokens: 4096, messages });
  });
  it.each([[{}, "stop"], [{ ...empty, new_facts: [{ fact: 3 }] }, "stop"], [empty, "length"], [empty, "tool_calls"]])(
    "rejects incomplete/malformed/truncated output", async (value, finish) => {
      expect((await museMemoryCompletion(profile, messages, { fetcher: vi.fn().mockResolvedValue(completion(value, finish)) })).status).toBe("invalid");
    });
  it("swallows HTTP and network failures without retries", async () => {
    for (const fetcher of [vi.fn().mockResolvedValue(new Response("error", { status: 503 })), vi.fn().mockRejectedValue(new Error("private error"))]) {
      expect((await museMemoryCompletion(profile, messages, { fetcher })).status).toBe("error");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("bounds transport that ignores abort, including stalled body reads", async () => {
    vi.useFakeTimers();
    for (const fetcher of [vi.fn(() => new Promise<Response>(() => {})),
      vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) })]) {
      const pending = museMemoryCompletion(profile, messages, { fetcher, timeoutMs: 25 });
      await vi.advanceTimersByTimeAsync(26);
      expect(await pending).toEqual({ status: "timeout" });
      expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    }
  });
});

describe("write-free extraction shadow", () => {
  const input = { businessId: "staged-A", leadId: "synthetic-lead", businessOptIn: true,
    memoryMode: "full" as const, activeFacts: [], baseline: empty, messages };
  function enable() {
    vi.stubEnv("MUSE_MEMORY_SHADOW_ENABLED", "true");
    vi.stubEnv("MUSE_MEMORY_STAGED_BUSINESS_ID", "staged-A");
    vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
    vi.stubEnv("MUSE_MEMORY_MODEL", "fixture-model");
  }
  it("does no egress or logging by default", async () => {
    vi.stubEnv("MUSE_MEMORY_SHADOW_ENABLED", undefined);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await logMuseExtractionShadow(input);
    expect(fetcher).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
  it("routes staged A only, never business B or foreign-scope facts", async () => {
    enable(); const fetcher = vi.fn().mockImplementation(async () => completion()); vi.stubGlobal("fetch", fetcher);
    vi.spyOn(console, "info").mockImplementation(() => {});
    await logMuseExtractionShadow(input);
    await logMuseExtractionShadow({ ...input, businessId: "business-B" });
    await logMuseExtractionShadow({ ...input, activeFacts: [{ business_id: "business-B", lead_id: input.leadId } as CallerMemoryFact] });
    await logMuseExtractionShadow({ ...input, activeFacts: [{ business_id: input.businessId, lead_id: "other-lead" } as CallerMemoryFact] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("logs structural differences with no caller content, never mutates baseline", async () => {
    enable(); const baselineBefore = JSON.stringify(input.baseline);
    const output = { ...empty, new_facts: [{ fact: "SYNTHETIC SECRET mornings", category: "preference", expires_at: null }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion(output)));
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await logMuseExtractionShadow(input);
    expect(log.mock.calls[0][1]).toMatchObject({ status: "ok", changedFields: ["new_facts"] });
    expect(JSON.stringify(log.mock.calls)).not.toContain("SYNTHETIC");
    expect(JSON.stringify(input.baseline)).toBe(baselineBefore);
  });
  it("resolves even when transport and logging fail", async () => {
    enable(); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private caller content")));
    vi.spyOn(console, "info").mockImplementation(() => { throw new Error("logger failed"); });
    await expect(logMuseExtractionShadow(input)).resolves.toBeUndefined();
  });
});
