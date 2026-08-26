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
  conceptMentions: z.array(z.object({
    term: z.string().min(2).max(80),
    sourceLocators: z.array(z.string()),
  })).max(6),
  rubricEvaluation: z.array(z.object({
    criterionCode: z.string().min(1).max(120),
    status: z.enum(["MET", "PARTIALLY_MET", "NOT_MET", "CONTRADICTED"]),
    evidence: z.string().max(600),
  })).max(30),
});

export type TutorTurn = z.infer<typeof tutorTurnSchema>;

export interface TutorContext {
  phase: "DIAGNOSTIC" | "PLAN" | "LEARNING";
  objectiveCode: string;
  objectiveDescription: string;
  objectiveGuidance: string;
  domainGuardrails: string[];
  scaffoldLevel: number;
  mastery: number;
  desiredChallenge: "RECALL" | "MECHANISM" | "TRANSFER";
  forceExplanation: boolean;
  clarificationRequest: boolean;
  currentQuestion: string;
  questionRequiresExplanation: boolean;
  questionRubric?: {
    id: string;
    title: string;
    sourceType: "CKE_EXACT" | "CKE_DERIVED" | "TEACHER_SPECIFIC" | "CURRICULUM_DERIVED" | "INTERNAL_LEARNING";
    scoringMode: "LEARNING_EVIDENCE" | "EXAM_POINTS";
    sourceLocator: string | null;
    sourceVersion: string | null;
    maxPoints: number | null;
    criteria: Array<{
      code: string;
      description: string;
      required: boolean;
      points: number | null;
      evidenceLevel: string;
    }>;
  };
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
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
  validationAudit?: {
    reportedLearningObjectives: string[];
    acceptedLearningObjectives: string[];
    reportedSourceLocators: string[];
    acceptedSourceLocators: string[];
    rejectedSourceLocators: string[];
    issues: string[];
  };
}

export interface AIProvider extends ExplanationProvider, ConceptAIProvider, SideChatAIProvider {
  assessAndRespond(context: TutorContext): Promise<AIResult>;
  interpretTestScope(context: TestScopeContext): Promise<ConceptAIResult<TestScopeInterpretation>>;
}

export const mockExamGradingSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    assessment: z.enum(["INCORRECT", "PARTIALLY_CORRECT", "CORRECT", "TRANSFER_DEMONSTRATED"]),
    feedback: z.string().min(1).max(900),
    sourceLocators: z.array(z.string()),
    criteria: z.array(z.object({
      criterionCode: z.string().min(1).max(120),
      status: z.enum(["MET", "PARTIALLY_MET", "NOT_MET", "CONTRADICTED"]),
      evidence: z.string().max(600),
    })).max(30),
  })).min(1).max(20),
  overallSummary: z.string().min(1).max(1800),
});

export type MockExamGrading = z.infer<typeof mockExamGradingSchema>;

export interface MockExamGradingContext {
  questions: Array<{
    id: string;
    prompt: string;
    answer: string;
    rubric: {
      sourceType: "CKE_EXACT" | "CKE_DERIVED" | "TEACHER_SPECIFIC" | "CURRICULUM_DERIVED" | "INTERNAL_LEARNING";
      sourceLocator: string | null;
      criteria: Array<{ code: string; description: string; required: boolean; points: number }>;
    };
    allowedSourceLocators: string[];
  }>;
  knowledge: KnowledgeExcerpt[];
}

export interface MockExamAIProvider {
  gradeMockExam(context: MockExamGradingContext): Promise<ConceptAIResult<MockExamGrading>>;
}

export const testScopeInterpretationSchema = z.object({
  summary: z.string().min(1).max(1200),
  expectedTaskTypes: z.array(z.string().min(1).max(120)).max(8),
  pageRanges: z.array(z.object({
    from: z.number().int().min(1).max(5000),
    to: z.number().int().min(1).max(5000),
  })).max(10),
  objectiveRecommendations: z.array(z.object({
    objectiveCode: z.string().min(1).max(100),
    scope: z.enum(["INCLUDED", "EXCLUDED", "PRIORITY"]),
    reason: z.string().min(1).max(300),
  })).max(100),
});

export type TestScopeInterpretation = z.infer<typeof testScopeInterpretationSchema>;

export interface TestScopeContext {
  teacherNote: string;
  objectives: Array<{ code: string; topicTitle: string; title: string; description: string }>;
}

export const sideChatAnswerSchema = z.object({
  answer: z.string().min(1).max(1800),
  sourceLocators: z.array(z.string()),
});

export type SideChatAnswer = z.infer<typeof sideChatAnswerSchema>;

export interface SideChatContext {
  question: string;
  objectiveTitle: string;
  objectiveDescription: string;
  objectiveGuidance: string;
  knowledge: KnowledgeExcerpt[];
  recentMessages: { role: "TUTOR" | "STUDENT"; content: string }[];
}

export interface SideChatAIProvider {
  answerSideQuestion(context: SideChatContext): Promise<ConceptAIResult<SideChatAnswer>>;
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
  explainSelection(context: QuickExplanationContext): Promise<ConceptAIResult<QuickExplanation>>;
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
  latencyMs: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
}

export interface ConceptAIProvider {
  assessConcept(context: ConceptTutorContext): Promise<ConceptAIResult<ConceptTurn>>;
  generateConcept(context: ConceptGenerationContext): Promise<ConceptAIResult<GeneratedConcept>>;
}
