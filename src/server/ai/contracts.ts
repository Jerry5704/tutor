import { z } from "zod";

export const tutorTurnSchema = z.object({
  feedback: z.string().min(1),
  nextQuestion: z.string().min(1).nullable(),
  studentIntent: z.enum(["ANSWER", "UNCERTAIN", "REQUEST_HELP", "OFF_TOPIC"]),
  assessment: z.enum(["INCORRECT", "PARTIALLY_CORRECT", "CORRECT", "TRANSFER_DEMONSTRATED"]),
  evidenceLevel: z.enum(["NONE", "RECALL", "MECHANISM", "TRANSFER"]),
  misconceptions: z.array(z.string()),
  learningObjectives: z.array(z.string()).min(1),
  nextAction: z.enum(["PROBE", "GUIDED_QUESTION", "HINT", "EXPLAIN", "WORKED_EXAMPLE", "TRANSFER_QUESTION", "NEXT_OBJECTIVE", "SHOW_PLAN", "COMPLETE_SESSION"]),
  rationale: z.string().min(1),
  sourceLocators: z.array(z.string()),
});

export type TutorTurn = z.infer<typeof tutorTurnSchema>;

export interface TutorContext {
  phase: "DIAGNOSTIC" | "PLAN" | "LEARNING";
  objectiveCode: string;
  objectiveDescription: string;
  objectiveGuidance: string;
  scaffoldLevel: number;
  mastery: number;
  desiredChallenge: "RECALL" | "MECHANISM" | "TRANSFER";
  forceExplanation: boolean;
  clarificationRequest: boolean;
  teacherScopeNote?: string;
  knowledge: KnowledgeExcerpt[];
  recentMessages: { role: "TUTOR" | "STUDENT"; content: string }[];
  answer: string;
}

export interface KnowledgeExcerpt {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  locator: string;
  content: string;
}

export interface AIResult {
  turn: TutorTurn;
  responseId: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIProvider { assessAndRespond(context: TutorContext): Promise<AIResult>; }

export const quickExplanationSchema = z.object({
  explanation: z.string().min(1).max(900),
  sourceLocators: z.array(z.string()),
});

export type QuickExplanation = z.infer<typeof quickExplanationSchema>;

export interface QuickExplanationContext {
  selectedText: string;
  surroundingMessage: string;
  objectiveTitle: string;
  objectiveDescription: string;
  objectiveGuidance: string;
  knowledge: KnowledgeExcerpt[];
}

export interface ExplanationProvider {
  explainSelection(context: QuickExplanationContext): Promise<QuickExplanation>;
}
