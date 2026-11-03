import { afterEach, describe, expect, it, vi } from "vitest";
import { eligibleMuseRecallFacts, selectMuseCitedRecall, type MuseRecallInput } from "./museRecall";
import { GOLDEN_MEMORY_SCENARIOS, runGoldenMemoryRecall } from "@/lib/evals/goldenMemoryScenarios";

const profile = { model: "fixture-model", apiKey: "fixture-key", endpoint: "https://fixture.invalid" };
function input(): MuseRecallInput { return structuredClone(GOLDEN_MEMORY_SCENARIOS[0].recallFixture!.input); }
function response(ids: string[]) { return new Response(JSON.stringify({ id: "fixture-request", model: profile.model,
  choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ fact_ids: ids }) } }] })); }
afterEach(() => vi.useRealTimers());

describe("cited recall provenance boundary", () => {
  it("rehydrates exact source text and call ID, dropping unknown generated IDs", async () => {
    const sample = input();
    const result = await selectMuseCitedRecall(profile, sample, { fetcher: vi.fn().mockResolvedValue(response(["invented", "fact-current"])) });
    expect(result.facts).toEqual([{ factId: "fact-current", fact: sample.facts[0].fact, sourceCallId: "synthetic-call-A", confidence: 0.95 }]);
    expect(result.rejectedSelections).toBe(1);
  });
  it.each(["business", "caller", "call-business", "call-caller", "missing-call", "missing-source", "expired", "invalid-expiry", "conflicted", "corrected", "superseded", "low-confidence", "duplicate-id"])("drops %s evidence before model egress", async failure => {
    const sample = input();
    if (failure === "business") sample.facts[0].business_id = "foreign";
    if (failure === "caller") sample.facts[0].lead_id = "foreign";
    if (failure === "call-business") sample.sourceCalls[0].business_id = "foreign";
    if (failure === "call-caller") sample.sourceCalls[0].lead_id = "foreign";
    if (failure === "missing-call") sample.sourceCalls = [];
    if (failure === "missing-source") sample.facts[0].source_call_id = null;
    if (failure === "expired") sample.facts[0].expires_at = sample.now;
    if (failure === "invalid-expiry") sample.facts[0].expires_at = "invalid";
    if (failure === "conflicted") sample.facts[0].status = "conflicted";
    if (failure === "corrected") sample.facts[0].status = "corrected";
    if (failure === "superseded") sample.facts[0].superseded_by = "replacement";
    if (failure === "low-confidence") sample.facts[0].confidence = 0.2;
    if (failure === "duplicate-id") sample.facts.push({ ...sample.facts[0], fact: "conflicting duplicate" });
    const fetcher = vi.fn();
    expect((await selectMuseCitedRecall(profile, sample, { fetcher })).facts).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["off", "unidentified", "truthy-identity", "unknown-mode", "no-history", "invalid-clock", "contact-only", "category-optout"])("does no egress for %s", async condition => {
    const sample = input();
    if (condition === "off") sample.memoryMode = "off";
    if (condition === "unidentified") sample.identityVerified = false;
    if (condition === "truthy-identity") sample.identityVerified = "true" as unknown as boolean;
    if (condition === "unknown-mode") sample.memoryMode = "unexpected" as unknown as "full";
    if (condition === "no-history") sample.facts = [];
    if (condition === "invalid-clock") sample.now = "invalid";
    if (condition === "contact-only") sample.memoryMode = "contact_only";
    if (condition === "category-optout") sample.allowedCategories = [];
    const fetcher = vi.fn();
    expect(eligibleMuseRecallFacts(sample)).toEqual([]);
    expect((await selectMuseCitedRecall(profile, sample, { fetcher })).facts).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not export foreign text even when mixed with valid evidence", async () => {
    const sample = input(); sample.facts.push({ ...sample.facts[0], id: "foreign", business_id: "foreign", fact: "PRIVATE FOREIGN TEXT" });
    const fetcher = vi.fn().mockResolvedValue(response(["foreign", "fact-current"]));
    const result = await selectMuseCitedRecall(profile, sample, { fetcher });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("PRIVATE FOREIGN TEXT");
    expect(result.facts.map(fact => fact.factId)).toEqual(["fact-current"]);
  });
  it("rejects generated prose instead of IDs", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop",
      message: { content: JSON.stringify({ fact_ids: ["fact-current"], inventedText: "50% discount" }) } }] })));
    const result = await selectMuseCitedRecall(profile, input(), { fetcher });
    expect(result.status).toBe("invalid"); expect(result.facts).toEqual([]);
  });
  it("never repeats duplicate model selections and drops all unsupported selections", async () => {
    const result = await selectMuseCitedRecall(profile, input(), { fetcher: vi.fn().mockResolvedValue(response(["fact-current", "fact-current", "unknown"])) });
    expect(result.facts).toHaveLength(1); expect(result.rejectedSelections).toBe(2);
  });
  it("respects business retention even when an active fact has no explicit expiry", async () => {
    const sample = input(); sample.retentionDays = 30; sample.facts[0].created_at = "2026-01-01T00:00:00Z";
    const fetcher = vi.fn(); expect((await selectMuseCitedRecall(profile, sample, { fetcher })).facts).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds a transport ignoring abort and never retries", async () => {
    vi.useFakeTimers(); const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    const pending = selectMuseCitedRecall(profile, input(), { fetcher, timeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(11);
    expect(await pending).toMatchObject({ status: "timeout", facts: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("existing golden-memory registry offline extension", () => {
  it("runs every existing/new registry fixture without credentials or provider evidence", async () => {
    const report = await runGoldenMemoryRecall({ mode: "fixture" });
    expect(report.rows).toHaveLength(GOLDEN_MEMORY_SCENARIOS.length);
    expect(report.rows.every(row => row.passed)).toBe(true);
    expect(report.liveMuseVerified).toBe(false);
    expect(report.productionGate).toBe("not-evaluated");
    expect(report.rows.every(row => row.requestId === undefined)).toBe(true);
  });
  it("rejects missing credentials and oversized provider runs before requests", async () => {
    await expect(runGoldenMemoryRecall({ mode: "provider" })).rejects.toThrow("Exact provider");
    await expect(runGoldenMemoryRecall({ mode: "provider", profile })).rejects.toThrow("four scenarios");
  });
  it("reserves every provider attempt, limits tokens and captures only structural model evidence", async () => {
    const providerProfile = { ...profile, model: "meta/muse-wonder" };
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      expect(body.max_tokens).toBe(1024); expect(body.reasoning).toEqual({ effort: "minimal" });
      const query = JSON.parse(body.messages[1].content).query;
      return new Response(JSON.stringify({ id: "synthetic-provider-id", model: providerProfile.model,
        usage: { prompt_tokens: 20, completion_tokens: 10, cost: 0.00028 },
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ fact_ids: query.includes("50%") ? [] : ["fact-current"] }) } }] }));
    });
    const report = await runGoldenMemoryRecall({ mode: "provider", profile: providerProfile, fetcher,
      scenarioNames: ["golden.memory.known-job-recall", "golden.memory.corrected-fact-suppression", "golden.memory.open-loop-payoff", "golden.memory.prompt-injection-resistance"] });
    expect(report.rows.every(row => row.passed)).toBe(true);
    expect(report.providerRequests).toBe(4); expect(report.reservedWorstCaseUsd).toBeGreaterThan(0);
    expect(report.reservedWorstCaseUsd).toBeLessThan(1); expect(fetcher).toHaveBeenCalledTimes(4);
    expect(report.providerReportedCostUsd).toBeCloseTo(0.00112);
  });
  it("never labels a different response model as the configured Muse model", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(["fact-current"]));
    const report = await runGoldenMemoryRecall({ mode: "provider", profile: { ...profile, model: "meta/muse-wonder" }, fetcher,
      scenarioNames: ["golden.memory.known-job-recall"] });
    expect(report.rows[0].passed).toBe(false); expect(report.liveMuseVerified).toBe(false);
  });
  it("retains reservation on provider failure and does not retry", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("transport"));
    const report = await runGoldenMemoryRecall({ mode: "provider", profile: { ...profile, model: "meta/muse-wonder" }, fetcher,
      scenarioNames: ["golden.memory.known-job-recall"] });
    expect(report.providerRequests).toBe(1); expect(report.reservedWorstCaseUsd).toBeGreaterThan(0);
    expect(report.providerCostCoverage).toBe("partial"); expect(report.rows[0].passed).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
