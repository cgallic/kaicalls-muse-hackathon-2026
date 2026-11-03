/**
 * Types for Vapi Mock Conversation Eval System
 *
 * These model the Vapi eval API (POST /eval, POST /eval/run)
 * for running automated test conversations against assistants.
 */

// --- Judge Plans ---

export interface AIJudgeModel {
  provider: string;
  model: string;
  messages: { role: string; content: string }[];
}

export interface ToolCallCheck {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface JudgePlan {
  type: 'exact' | 'regex' | 'ai';
  /** For exact/regex judge types */
  content?: string;
  /** For AI judge type */
  model?: AIJudgeModel;
  /**
   * For tool call verification — **`exact` / `regex` judge types ONLY**.
   *
   * Vapi rejects this property on an `ai` judge plan
   * (`400 messages.N.judgePlan.property toolCalls should not exist`, #1209).
   * It also compares the tool-call argument set by exact key COUNT, so it is a
   * poor fit for tools with optional parameters. To assert tool use from an AI
   * judge, use `buildToolUseJudgePlan()` in `@/lib/vapi/evalRunner`.
   * `validateEvalScenario()` in `@/lib/evals/evalMessageSchema` enforces this.
   */
  toolCalls?: ToolCallCheck[];
}

export interface ContinuePlan {
  exitOnFailureEnabled: boolean;
  contentOverride?: string;
}

// --- Eval Messages ---

export interface EvalUserMessage {
  role: 'user';
  content: string;
}

export interface EvalAssistantMessage {
  role: 'assistant';
  content?: string;
  /**
   * Optional — required only for the final assistant turn (the one being judged).
   * Intermediate "scripted" assistant turns (used as conversation context in mock
   * conversation evals) may omit it.
   */
  judgePlan?: JudgePlan;
  continuePlan?: ContinuePlan;
  /**
   * Scripted (unjudged) turns only: a tool call the assistant "made", so the
   * next `tool` turn's mocked result can be fed to it. The provider links the
   * following `tool` turn to this call. See `mockToolCallTurn()` in
   * `@/lib/evals/toolEvalFixtures`.
   */
  toolCalls?: ToolCallCheck[];
}

export interface EvalSystemMessage {
  role: 'system';
  content: string;
}

export interface EvalToolMessage {
  role: 'tool';
  content: string;
}

export type VapiEvalMessage =
  | EvalUserMessage
  | EvalAssistantMessage
  | EvalSystemMessage
  | EvalToolMessage;

