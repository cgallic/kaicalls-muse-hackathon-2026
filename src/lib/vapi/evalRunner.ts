import type { JudgePlan } from '@/types/vapiEval';

export function buildAIJudgePlan(criteria: string): JudgePlan {
  return {
    type: 'ai',
    model: {
      provider: 'openai',
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `Evaluate: {{messages[-1]}}\nContext: {{messages}}\n\n${criteria}\n\nOutput exactly: pass or fail`,
        },
      ],
    },
  };
}
