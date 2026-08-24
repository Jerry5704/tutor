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

export interface AIProvider extends ExplanationProvider, ConceptAIProvider {
  assessAndRespond(context: TutorContext): Promise<AIResult>;
}

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

export const conceptTurnSchema = z.object({
  assessment: z.enum(["INCORRECT", "PARTIALLY_CORRECT", "CORRECT", "TRANSFER_DEMONSTRATED"]),
  evidenceLevel: z.enum(["NONE", "RECALL", "MECHANISM", "TRANSFER"]),
  feedback: z.string(),
  directAnswer: z.string(),
  nextQuestion: z.string().nullable(),
  rationale: z.string(),
});

export type ConceptTurn = z.infer<typeof conceptTurnSchema>;

export interface ConceptTutorContext {
  conceptName: string;
  shortDefinition: string;
  simpleExplanation: string;
  whyItMatters: string;
  concreteExample?: string;
  checkQuestion?: string;
  transferQuestion?: string;
  commonMisconception?: string;
  sources: Array<{ locator: string; content: string }>;
  phase: string;
  recentMessages: { role: "TUTOR" | "STUDENT"; content: string }[];
  answer: string;
  helpRequested: boolean;
}

export const generatedConceptSchema = z.object({
  supportedBySources: z.boolean(),
  canonicalName: z.string(),
  shortDefinition: z.string(),
  simpleExplanation: z.string(),
  whyItMatters: z.string(),
  commonMisconception: z.string(),
  concreteExample: z.string(),
  checkQuestion: z.string(),
  transferQuestion: z.string(),
  aliases: z.array(z.string()),
});

export type GeneratedConcept = z.infer<typeof generatedConceptSchema>;

export interface ConceptGenerationContext {
  requestedTerm: string;
  objectiveDescription: string;
  sources: Array<{ locator: string; content: string }>;
}

export interface ConceptAIResult<T> {
  value: T;
  responseId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ConceptAIProvider {
  assessConcept(context: ConceptTutorContext): Promise<ConceptAIResult<ConceptTurn>>;
  generateConcept(context: ConceptGenerationContext): Promise<ConceptAIResult<GeneratedConcept>>;
}
