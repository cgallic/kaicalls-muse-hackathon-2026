import { describe, expect, it } from 'vitest';

import {
  GOLDEN_MEMORY_SCENARIOS,
  toEvalScenario,
  type GoldenScenario,
} from '@/lib/evals/goldenMemoryScenarios';
import type { EvalAssistantMessage, VapiEvalMessage } from '@/types/vapiEval';

function isAssistant(m: VapiEvalMessage): m is EvalAssistantMessage {
  return m.role === 'assistant';
}

/** A judged assistant turn is one that carries a judgePlan (vs. a scripted context turn). */
function judgedAssistantTurns(scenario: GoldenScenario): EvalAssistantMessage[] {
  return scenario.messages.filter(isAssistant).filter((m) => m.judgePlan !== undefined);
}

describe('goldenMemoryScenarios fixture pack', () => {
  it('preserves ten original fixtures and adds no-history and cross-business coverage', () => {
    expect(GOLDEN_MEMORY_SCENARIOS.length).toBe(12);
  });

  it('has unique fixture names', () => {
    const names = GOLDEN_MEMORY_SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names every fixture with the golden.memory.* prefix', () => {
    for (const s of GOLDEN_MEMORY_SCENARIOS) {
      expect(s.name.startsWith('golden.memory.')).toBe(true);
    }
  });

  it('includes all ten spec-required scenarios', () => {
    const names = GOLDEN_MEMORY_SCENARIOS.map((s) => s.name);
    expect(names).toContain('golden.memory.known-job-recall');
    expect(names).toContain('golden.memory.corrected-fact-suppression');
    expect(names).toContain('golden.memory.expired-commitment');
    expect(names).toContain('golden.memory.low-confidence-check-in');
    expect(names).toContain('golden.memory.shared-phone-ambiguity');
    expect(names).toContain('golden.memory.anonymous-caller');
    expect(names).toContain('golden.memory.contradiction-live');
    expect(names).toContain('golden.memory.open-loop-payoff');
    expect(names).toContain('golden.memory.memory-vs-KB-precedence');
    expect(names).toContain('golden.memory.prompt-injection-resistance');
  });

  it('ends every scenario with a judged assistant turn carrying an AI judgePlan', () => {
    for (const s of GOLDEN_MEMORY_SCENARIOS) {
      const last = s.messages[s.messages.length - 1];
      expect(last.role, `${s.name} must end on an assistant turn`).toBe('assistant');

      const judged = judgedAssistantTurns(s);
      expect(
        judged.length,
        `${s.name} must have at least one judged assistant turn`,
      ).toBeGreaterThan(0);

      for (const turn of judged) {
        expect(turn.judgePlan?.type, `${s.name} judgePlan must be an AI judge`).toBe('ai');
        // buildAIJudgePlan wires gpt-4.1 with a single system message containing the criteria.
        expect(turn.judgePlan?.model?.model).toBe('gpt-4.1');
        const criteria = turn.judgePlan?.model?.messages?.[0]?.content ?? '';
        expect(criteria.length, `${s.name} judge criteria must be non-trivial`).toBeGreaterThan(40);
      }
    }
  });

  it('does not put a judgePlan on scripted context turns (only on judged turns)', () => {
    for (const s of GOLDEN_MEMORY_SCENARIOS) {
      const assistantTurns = s.messages.filter(isAssistant);
      // Any assistant turn that is NOT a judged turn must be a plain scripted context
      // turn: it carries `content` and no judgePlan.
      for (const turn of assistantTurns) {
        if (turn.judgePlan === undefined) {
          expect(typeof turn.content, `${s.name} scripted assistant turn needs content`).toBe(
            'string',
          );
        }
      }
    }
  });

  it('starts every scenario with a user turn', () => {
    for (const s of GOLDEN_MEMORY_SCENARIOS) {
      expect(s.messages[0]?.role, `${s.name} must open with a user turn`).toBe('user');
    }
  });

  it('marks every phase-1 fixture as text (audio reserved for phase 2)', () => {
    for (const s of GOLDEN_MEMORY_SCENARIOS) {
      expect(s.phase).toBe('text');
      expect(s.audioFixtureUrl).toBeUndefined();
    }
  });

  it('toEvalScenario strips fixtures down to the Vapi-accepted shape', () => {
    const sample = GOLDEN_MEMORY_SCENARIOS[0];
    const stripped = toEvalScenario(sample);
    expect(Object.keys(stripped).sort()).toEqual(['description', 'messages', 'name']);
    expect(stripped).not.toHaveProperty('phase');
    expect(stripped).not.toHaveProperty('audioFixtureUrl');
  });
});
