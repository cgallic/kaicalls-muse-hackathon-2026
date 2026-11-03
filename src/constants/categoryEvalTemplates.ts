import type { VapiEvalMessage } from '@/types/vapiEval';

export interface EvalScenario {
  /** Stable machine name (no spaces) — used for idempotency checks */
  name: string;
  description: string;
  messages: VapiEvalMessage[];
}
