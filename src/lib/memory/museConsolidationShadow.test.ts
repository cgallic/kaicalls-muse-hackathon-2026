import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";
import { GOLDEN_MEMORY_SCENARIOS } from "@/lib/evals/goldenMemoryScenarios";
import { consolidationResultSchema } from "./consolidationContract";
import { logMuseConsolidationShadow } from "./museShadow";

function input() {
  const fixture = GOLDEN_MEMORY_SCENARIOS[0].recallFixture!.input;
  const baseline = consolidationResultSchema.parse({ relationship_digest: "PRIVATE SYNTHETIC baseline" });
  return {
    businessId: fixture.businessId, leadId: fixture.leadId, businessOptIn: true,
    memoryMode: "full" as const, activeFacts: structuredClone(fixture.facts), baseline,
    schema: consolidationResultSchema as ZodType<typeof baseline>,
    messages: [{ role: "user" as const, content: "PRIVATE SYNTHETIC source packet" }],
  };
}

beforeEach(() => {
  vi.stubEnv("MUSE_MEMORY_SHADOW_ENABLED", "true");
  vi.stubEnv("MUSE_MEMORY_CONSOLIDATION_SHADOW_ENABLED", "true");
  vi.stubEnv("MUSE_MEMORY_STAGED_BUSINESS_ID", "synthetic-business-A");
  vi.stubEnv("MUSE_MEMORY_MODEL", "fixture-model");
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("standalone consolidation-shadow contract", () => {
  it.each(["off", "extraction-only", "wrong-business", "unapproved-business", "foreign-source"])(
    "does no provider work for %s", async condition => {
      const sample = input();
      if (condition === "off") vi.stubEnv("MUSE_MEMORY_SHADOW_ENABLED", undefined);
      if (condition === "extraction-only") vi.stubEnv("MUSE_MEMORY_CONSOLIDATION_SHADOW_ENABLED", undefined);
      if (condition === "wrong-business") sample.businessId = "synthetic-business-B";
      if (condition === "unapproved-business") sample.businessOptIn = false;
      if (condition === "foreign-source") sample.activeFacts[0].lead_id = "synthetic-other-caller";
      const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
      await logMuseConsolidationShadow(sample);
      expect(fetcher).not.toHaveBeenCalled(); expect(console.info).not.toHaveBeenCalled();
    },
  );

  it("keeps the exact packet and baseline while logging only field differences", async () => {
    const sample = input(); const original = JSON.stringify(sample.baseline);
    const alternative = { ...sample.baseline, relationship_digest: "PRIVATE SYNTHETIC alternative" };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop",
      message: { content: JSON.stringify(alternative) } }] })));
    vi.stubGlobal("fetch", fetcher);
    expect(await logMuseConsolidationShadow(sample)).toBeUndefined();
    expect(JSON.parse(fetcher.mock.calls[0][1].body).messages).toEqual(sample.messages);
    expect(JSON.stringify(sample.baseline)).toBe(original);
    expect(console.info).toHaveBeenCalledWith("[MuseConsolidationShadow]", expect.objectContaining({
      status: "ok", changedFields: ["relationship_digest"],
    }));
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("PRIVATE SYNTHETIC");
  });

  it("rejects incomplete structured responses instead of admitting schema defaults", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop",
      message: { content: "{}" } }] }))));
    await logMuseConsolidationShadow(input());
    expect(console.info).toHaveBeenCalledWith("[MuseConsolidationShadow]", expect.objectContaining({ status: "invalid" }));
  });
});
