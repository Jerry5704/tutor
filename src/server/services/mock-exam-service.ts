import type { MockExamAIProvider } from "@/server/ai/contracts";
import { db } from "@/server/db/client";
import { MOCK_EXAM_PROMPT_VERSION } from "@/server/prompts/mock-exam";
import { AIRateLimitService } from "@/server/services/ai-rate-limit-service";
import { AIUsageService } from "@/server/services/ai-usage-service";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { LearningEventService } from "@/server/services/learning-event-service";
import {
  mockQuestionsPerObjectiveForAttempt,
  REQUIRED_MOCK_QUESTIONS_PER_OBJECTIVE,
  scoreMockExam,
  selectMockQuestionIds,
} from "@/server/services/mock-exam-policy";
import { StudentModelService } from "@/server/services/student-model-service";
import { objectivesInTestScope } from "@/server/services/test-plan-policy";

type RubricSnapshot = {
  id: string;
  sourceType: "CKE_EXACT" | "CKE_DERIVED" | "TEACHER_SPECIFIC" | "CURRICULUM_DERIVED" | "INTERNAL_LEARNING";
  sourceLocator: string | null;
  sourceVersion: string | null;
  maxPoints: number;
  criteria: Array<{
    id: string;
    code: string;
    description: string;
    required: boolean;
    points: number;
  }>;
};

const sourcePriority = {
  CKE_EXACT: 0,
  CKE_DERIVED: 1,
  CURRICULUM_DERIVED: 2,
  INTERNAL_LEARNING: 3,
  TEACHER_SPECIFIC: 4,
} as const;

export class MockExamService {
  constructor(
    private readonly ai: MockExamAIProvider,
    private readonly studentModel = new StudentModelService(),
    private readonly knowledge = new KnowledgeService(),
    private readonly rateLimit = new AIRateLimitService(),
    private readonly aiUsage = new AIUsageService(),
    private readonly learningEvents = new LearningEventService(),
  ) {}

  private async confirmedPlan(studentId: string, unitId: string) {
    return db.testPlan.findFirstOrThrow({
      where: { studentId, unitId, status: "CONFIRMED" },
      orderBy: { confirmedAt: "desc" },
      include: {
        objectives: {
          include: { learningObjective: true },
          orderBy: { learningObjective: { order: "asc" } },
        },
      },
    });
  }

  private async pool(studentId: string, unitId: string) {
    const plan = await this.confirmedPlan(studentId, unitId);
    const objectives = objectivesInTestScope(
      plan.objectives.map((row) => row.learningObjective),
      plan.objectives,
    );
    const objectiveIds = objectives.map((objective) => objective.id);
    const questions = await db.questionItemVersion.findMany({
      where: {
        purpose: "MOCK_EXAM",
        status: "APPROVED",
        objectives: { some: { learningObjectiveId: { in: objectiveIds } } },
        rubrics: { some: { status: "APPROVED", scoringMode: "EXAM_POINTS" } },
      },
      include: {
        objectives: true,
        rubrics: {
          where: {
            status: "APPROVED",
            scoringMode: "EXAM_POINTS",
            OR: [{ testPlanId: null }, { testPlanId: plan.id }],
          },
          include: { criteria: { orderBy: { code: "asc" } } },
        },
      },
      orderBy: [{ difficulty: "asc" }, { stableKey: "asc" }],
    });
    const usable = questions.flatMap((question) => {
      const rubric = question.rubrics.toSorted((left, right) => {
        const planDifference = Number(right.testPlanId === plan.id) - Number(left.testPlanId === plan.id);
        return planDifference || sourcePriority[left.sourceType] - sourcePriority[right.sourceType] || right.version - left.version;
      })[0];
      if (!rubric?.criteria.length) return [];
      return [{ question, rubric }];
    });
    return { plan, objectives, usable };
  }

  async availability(studentId: string, unitId: string) {
    const { objectives, usable } = await this.pool(studentId, unitId);
    const selection = selectMockQuestionIds(
      objectives.map((objective) => objective.id),
      usable.map(({ question }) => ({ id: question.id, objectiveIds: question.objectives.map((link) => link.learningObjectiveId) })),
      REQUIRED_MOCK_QUESTIONS_PER_OBJECTIVE,
    );
    const missing = objectives.filter((objective) => selection.missingObjectiveIds.includes(objective.id));
    return {
      available: objectives.length > 0 && missing.length === 0,
      questionCount: selection.selectedIds.length,
      missingObjectives: missing.map((objective) => objective.title),
    };
  }

  async start(studentId: string, unitId: string) {
    const activeKey = `${studentId}:${unitId}`;
    const existing = await db.mockExamAttempt.findUnique({ where: { activeKey } });
    if (existing) return existing;
    const { plan, objectives, usable } = await this.pool(studentId, unitId);
    const previousAttemptCount = await db.mockExamAttempt.count({ where: { studentId, unitId, status: "GRADED" } });
    const selection = selectMockQuestionIds(
      objectives.map((objective) => objective.id),
      usable.map(({ question }) => ({
        id: question.id,
        objectiveIds: question.objectives.map((link) => link.learningObjectiveId),
      })),
      mockQuestionsPerObjectiveForAttempt(objectives.length),
      previousAttemptCount,
    );
    if (selection.missingObjectiveIds.length) {
      const missing = objectives.filter((objective) => selection.missingObjectiveIds.includes(objective.id));
      throw new Error(`Brakuje dwóch zatwierdzonych pytań próbnych dla: ${missing.map((objective) => objective.title).join(", ")}.`);
    }
    const byId = new Map(usable.map((item) => [item.question.id, item]));
    const selected = selection.selectedIds.flatMap((id) => byId.get(id) ?? []);
    const readinessBefore = await this.studentModel.readiness(studentId, objectives);
    const durationMinutes = Math.max(10, selected.reduce((sum, { question }) => sum + (question.expectedMinutes ?? 4), 0));
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
    const attempt = await db.mockExamAttempt.create({
      data: {
        activeKey,
        studentId,
        unitId,
        testPlanId: plan.id,
        readinessBefore,
        durationMinutes,
        expiresAt,
        promptVersion: MOCK_EXAM_PROMPT_VERSION,
        questions: {
          create: selected.map(({ question, rubric }, index) => {
            const criteria = rubric.criteria.map((criterion) => ({
              id: criterion.id,
              code: criterion.code,
              description: criterion.description,
              required: criterion.required,
              points: criterion.points ?? 0,
            }));
            const maxPoints = rubric.maxPoints ?? criteria.reduce((sum, criterion) => sum + criterion.points, 0);
            const snapshot: RubricSnapshot = {
              id: rubric.id,
              sourceType: rubric.sourceType,
              sourceLocator: rubric.sourceLocator,
              sourceVersion: rubric.sourceVersion,
              maxPoints,
              criteria,
            };
            return {
              order: index + 1,
              questionVersionId: question.id,
              questionRubricId: rubric.id,
              promptSnapshot: question.prompt,
              rubricSnapshot: snapshot,
              maxPoints,
              objectives: {
                create: question.objectives
                  .filter((link) => objectives.some((objective) => objective.id === link.learningObjectiveId))
                  .map((link) => ({ learningObjectiveId: link.learningObjectiveId, importance: link.importance })),
              },
            };
          }),
        },
      },
    });
    await this.learningEvents.record({
      studentId,
      eventType: "MOCK_EXAM_STARTED",
      metadata: { attemptId: attempt.id, unitId, questionCount: selected.length, durationMinutes },
      deduplicationKey: `mock-exam-started:${attempt.id}`,
    });
    return attempt;
  }

  async saveAnswer(studentId: string, attemptId: string, questionId: string, content: string) {
    const answer = content.trim();
    if (!answer || answer.length > 10_000) throw new Error("Odpowiedź musi mieć od 1 do 10 000 znaków.");
    const attempt = await db.mockExamAttempt.findFirstOrThrow({
      where: { id: attemptId, studentId, status: "IN_PROGRESS" },
    });
    if (attempt.expiresAt <= new Date()) throw new Error("Czas sprawdzianu minął. Oddaj zapisane odpowiedzi do oceny.");
    const question = await db.mockExamQuestion.findFirstOrThrow({ where: { id: questionId, attemptId } });
    await db.mockExamAnswer.upsert({
      where: { questionId: question.id },
      update: { content: answer, submittedAt: new Date() },
      create: { questionId: question.id, content: answer },
    });
    await this.learningEvents.record({
      studentId,
      eventType: "MOCK_EXAM_ANSWER_SAVED",
      metadata: { attemptId, questionId },
      deduplicationKey: `mock-exam-answer:${attemptId}:${questionId}`,
    });
  }

  async grade(studentId: string, attemptId: string) {
    const attempt = await db.mockExamAttempt.findFirstOrThrow({
      where: { id: attemptId, studentId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { objectives: true, answer: true },
        },
      },
    });
    if (attempt.status === "GRADED") return attempt;
    if (attempt.status === "GRADING") throw new Error("Sprawdzian jest już oceniany. Odśwież stronę za chwilę.");
    const limit = await this.rateLimit.consume(studentId);
    if (!limit.allowed) throw new Error("Limit odpowiedzi AI został osiągnięty. Spróbuj ponownie za kilka minut.");
    const claimed = await db.mockExamAttempt.updateMany({
      where: { id: attemptId, studentId, status: "IN_PROGRESS" },
      data: { status: "GRADING" },
    });
    if (claimed.count !== 1) throw new Error("Nie udało się rozpocząć oceniania tego podejścia.");

    try {
      const objectiveIds = [...new Set(attempt.questions.flatMap((question) => question.objectives.map((item) => item.learningObjectiveId)))];
      const knowledgeByObjective = new Map(await Promise.all(objectiveIds.map(async (objectiveId) => [
        objectiveId,
        await this.knowledge.retrieveForObjective(objectiveId, "próbny sprawdzian", 4),
      ] as const)));
      const knowledge = [...new Map([...knowledgeByObjective.values()].flat().map((excerpt) => [excerpt.chunkId, excerpt])).values()];
      const scoringQuestions = attempt.questions.map((question) => {
        const rubric = question.rubricSnapshot as RubricSnapshot;
        const allowedSourceLocators = [...new Set([
          ...question.objectives.flatMap((item) => knowledgeByObjective.get(item.learningObjectiveId)?.map((excerpt) => excerpt.locator) ?? []),
          ...(rubric.sourceLocator ? [rubric.sourceLocator] : []),
        ])];
        return {
          id: question.id,
          maxPoints: question.maxPoints,
          objectiveIds: question.objectives.map((item) => item.learningObjectiveId),
          allowedSourceLocators,
          criteria: rubric.criteria.map((criterion) => ({ id: criterion.id, code: criterion.code, points: criterion.points })),
          gradingInput: {
            id: question.id,
            prompt: question.promptSnapshot,
            answer: question.answer?.content ?? "",
            rubric: {
              sourceType: rubric.sourceType,
              sourceLocator: rubric.sourceLocator,
              criteria: rubric.criteria.map(({ code, description, required, points }) => ({ code, description, required, points })),
            },
            allowedSourceLocators,
          },
        };
      });
      const result = await this.aiUsage.capture({
        studentId,
        mockExamAttemptId: attempt.id,
        feature: "MOCK_EXAM_GRADING",
        promptVersion: MOCK_EXAM_PROMPT_VERSION,
      }, () => this.ai.gradeMockExam({
        questions: scoringQuestions.map((question) => question.gradingInput),
        knowledge,
      }));
      const scored = scoreMockExam(scoringQuestions, result.value);
      await db.$transaction(async (tx) => {
        for (const questionResult of scored.answers) {
          const question = attempt.questions.find((item) => item.id === questionResult.questionId);
          if (!question) continue;
          const answer = await tx.mockExamAnswer.upsert({
            where: { questionId: question.id },
            update: {
              rating: questionResult.assessment,
              feedback: questionResult.feedback,
              sourceLocators: questionResult.sourceLocators,
              earnedPoints: questionResult.earnedPoints,
              gradedAt: new Date(),
            },
            create: {
              questionId: question.id,
              content: "",
              rating: questionResult.assessment,
              feedback: questionResult.feedback,
              sourceLocators: questionResult.sourceLocators,
              earnedPoints: questionResult.earnedPoints,
              gradedAt: new Date(),
            },
          });
          await tx.mockExamCriterionResult.deleteMany({ where: { answerId: answer.id } });
          await tx.mockExamCriterionResult.createMany({
            data: questionResult.criteria.map((criterion) => ({
              answerId: answer.id,
              rubricCriterionId: criterion.criterionId,
              status: criterion.status,
              evidence: criterion.evidence,
              awardedPoints: criterion.awardedPoints,
            })),
          });
        }
        await tx.mockExamObjectiveResult.deleteMany({ where: { attemptId } });
        await tx.mockExamObjectiveResult.createMany({
          data: scored.objectives.map((objective) => ({ attemptId, ...objective })),
        });
        await tx.mockExamAttempt.update({
          where: { id: attemptId },
          data: {
            activeKey: null,
            status: "GRADED",
            score: scored.score,
            maxScore: scored.maxScore,
            percentage: scored.percentage,
            overallSummary: scored.overallSummary,
            providerResponseId: result.responseId,
            model: result.model,
            latencyMs: result.latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            gradedAt: new Date(),
          },
        });
      });
      await this.learningEvents.record({
        studentId,
        eventType: "MOCK_EXAM_GRADED",
        metadata: { attemptId, score: scored.score, maxScore: scored.maxScore, percentage: scored.percentage },
        deduplicationKey: `mock-exam-graded:${attemptId}`,
      });
      return db.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    } catch (error) {
      await db.mockExamAttempt.updateMany({ where: { id: attemptId, status: "GRADING" }, data: { status: "IN_PROGRESS" } });
      throw error;
    }
  }
}
