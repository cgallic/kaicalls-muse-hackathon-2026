import { z } from 'zod';

const consolidationDuplicateGroupSchema = z.object({
  keep_fact_id: z.string().min(1),
  duplicate_fact_ids: z.array(z.string().min(1)).default([]),
});

const consolidationConflictPairSchema = z.object({
  fact_id_a: z.string().min(1),
  fact_id_b: z.string().min(1),
});

const consolidationOpenLoopSchema = z.object({
  loop: z.string().min(1).max(240),
  due: z.string().nullable().optional(),
  owner: z.string().min(1),
  status: z.enum(['open', 'resolved', 'overdue']).optional(),
});

const consolidationResultSchema = z.object({
  duplicate_groups: z.array(consolidationDuplicateGroupSchema).default([]),
  conflict_pairs: z.array(consolidationConflictPairSchema).default([]),
  relationship_digest: z.string().max(2000).default(''),
  open_loops: z.array(consolidationOpenLoopSchema).default([]),
});

export { consolidationResultSchema };
