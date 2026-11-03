import { z } from 'zod';


export type FactCategory = 'preference' | 'commitment' | 'situation' | 'relationship' | 'identity';

export type FactProvenance =
  | 'extracted_call'
  | 'extracted_sms'
  | 'extracted_voicemail'
  | 'owner_stated'
  | 'caller_confirmed'
  | 'system';

export type FactStatus =
  | 'active'
  | 'conflicted'
  | 'corrected'
  | 'decayed'
  | 'expired'
  | 'forgotten';

export type MemoryMode = 'full' | 'contact_only' | 'off';

export interface CallerMemoryFact {
  id: string;
  business_id: string;
  lead_id: string;
  fact: string;
  category: FactCategory;
  confidence: number;
  provenance: FactProvenance;
  source_call_id: string | null;
  status: FactStatus;
  superseded_by: string | null;
  reinforced_count: number;
  last_reinforced_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenLoop {
  loop: string;
  due?: string | null;
  owner: string;
  status?: 'open' | 'resolved' | 'overdue';
}

/** One item in `MemoryExtractionResult.new_facts`. */
export interface ExtractedNewFact {
  fact: string;
  category: FactCategory;
  expires_at?: string | null;
}

/** One item in `MemoryExtractionResult.reinforcements`. */
export interface ExtractedReinforcement {
  fact_id: string;
}

/** One item in `MemoryExtractionResult.contradictions`. */
export interface ExtractedContradiction {
  fact_id: string;
  observed: string;
}

/** `MemoryExtractionResult.goal` — mirrors `customer_active_goals` write shape. */
export interface ExtractedGoal {
  current_goal: string;
  status: 'active' | 'completed' | 'cancelled';
  success_criteria: unknown[];
  next_action: Record<string, unknown>;
}

/**
 * Strict JSON shape returned by the single cheap-model extraction call
 * (see the spec's Section B). Zod-validated via `memoryExtractionSchema`
 * before anything is written to the ledger.
 */
export interface MemoryExtractionResult {
  new_facts: ExtractedNewFact[];
  reinforcements: ExtractedReinforcement[];
  contradictions: ExtractedContradiction[];
  goal: ExtractedGoal | null;
  open_loops: OpenLoop[];
}

const factCategorySchema = z.enum([
  'preference',
  'commitment',
  'situation',
  'relationship',
  'identity',
]);

const extractedNewFactSchema = z.object({
  fact: z.string().min(1).max(200),
  category: factCategorySchema,
  expires_at: z.string().nullable().optional(),
});

const extractedReinforcementSchema = z.object({
  fact_id: z.string().min(1),
});

const extractedContradictionSchema = z.object({
  fact_id: z.string().min(1),
  observed: z.string().min(1).max(200),
});

const openLoopSchema = z.object({
  loop: z.string().min(1).max(240),
  due: z.string().nullable().optional(),
  owner: z.string().min(1),
  status: z.enum(['open', 'resolved', 'overdue']).optional(),
});

const extractedGoalSchema = z.object({
  current_goal: z.string().min(1),
  status: z.enum(['active', 'completed', 'cancelled']),
  success_criteria: z.array(z.unknown()).default([]),
  next_action: z.record(z.unknown()).default({}),
});

/**
 * Zod schema for the extraction model's strict-JSON output. Every field is
 * defaulted so a partial/degenerate model response still parses to a safe
 * empty result rather than throwing on a missing key.
 */
export const memoryExtractionSchema = z.object({
  new_facts: z.array(extractedNewFactSchema).default([]),
  reinforcements: z.array(extractedReinforcementSchema).default([]),
  contradictions: z.array(extractedContradictionSchema).default([]),
  goal: extractedGoalSchema.nullable().default(null),
  open_loops: z.array(openLoopSchema).default([]),
});

export type MemoryExtractionSchemaOutput = z.infer<typeof memoryExtractionSchema>;
