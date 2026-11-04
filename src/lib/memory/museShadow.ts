import type { ZodType } from "zod";
import { getMuseMemoryProfile, museMemoryCompletion, museStructuredCompletion, type MuseMessages } from "./museClient";
import { resolveMuseMemoryShadowGate } from "./museGate";
import { isMuseConsolidationShadowEnabled, isMuseMemoryShadowEnabled } from "./memoryFlags";
import type { CallerMemoryFact, MemoryExtractionResult, MemoryMode } from "./types";

/** Output has no write path. Logs contain structural comparisons, never caller text. */
export async function logMuseExtractionShadow(input: {
  businessId: string; leadId: string; businessOptIn: unknown; memoryMode: MemoryMode;
  activeFacts: CallerMemoryFact[]; baseline: MemoryExtractionResult; messages: MuseMessages;
}): Promise<void> {
  try {
    if (!resolveMuseMemoryShadowGate({ flagEnabled: isMuseMemoryShadowEnabled(),
      businessId: input.businessId, stagedBusinessId: process.env.MUSE_MEMORY_STAGED_BUSINESS_ID,
      businessOptIn: input.businessOptIn, memoryMode: input.memoryMode })) return;
    // Do not export foreign facts even if a caller hands us a bad snapshot.
    if (input.activeFacts.some(fact => fact.business_id !== input.businessId || fact.lead_id !== input.leadId)) return;
    const result = await museMemoryCompletion(getMuseMemoryProfile(), input.messages);
    const changedFields = result.output ?
      (Object.keys(input.baseline) as Array<keyof MemoryExtractionResult>)
        .filter(key => JSON.stringify(input.baseline[key]) !== JSON.stringify(result.output![key])) : undefined;
    // eslint-disable-next-line no-console -- P1 structural observation, never source/output text.
    console.info("[MuseMemoryShadow]", { businessId: input.businessId, status: result.status,
      requestId: result.requestId, promptTokens: result.promptTokens,
      completionTokens: result.completionTokens, reasoningTokens: result.reasoningTokens,
      changedFields });
  } catch {
    // Never alter incumbent extraction results, canonical writes or retry behavior.
  }
}

/** Same immutable consolidation packet, structural comparison only. No result/write channel. */
export async function logMuseConsolidationShadow<T extends Record<string, unknown>>(input: {
  businessId: string; leadId: string; businessOptIn: unknown; memoryMode: MemoryMode;
  activeFacts: CallerMemoryFact[]; baseline: T; schema: ZodType<T>; messages: MuseMessages;
}): Promise<void> {
  try {
    if (!isMuseConsolidationShadowEnabled() || !resolveMuseMemoryShadowGate({ flagEnabled: isMuseMemoryShadowEnabled(),
      businessId: input.businessId, stagedBusinessId: process.env.MUSE_MEMORY_STAGED_BUSINESS_ID,
      businessOptIn: input.businessOptIn, memoryMode: input.memoryMode })) return;
    if (input.activeFacts.some(fact => fact.business_id !== input.businessId || fact.lead_id !== input.leadId)) return;
    const result = await museStructuredCompletion(getMuseMemoryProfile(), input.messages, input.schema, Object.keys(input.baseline));
    const changedFields = result.output ? Object.keys(input.baseline)
      .filter(key => JSON.stringify(input.baseline[key]) !== JSON.stringify(result.output![key])) : undefined;
    // eslint-disable-next-line no-console -- structural experiment metadata only, never facts/prompts/output.
    console.info("[MuseConsolidationShadow]", { businessId: input.businessId, status: result.status,
      requestId: result.requestId, promptTokens: result.promptTokens, completionTokens: result.completionTokens,
      reasoningTokens: result.reasoningTokens, changedFields });
  } catch {
    // Failure cannot alter incumbent consolidation output, writes or retry policy.
  }
}
