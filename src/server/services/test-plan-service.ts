import type { AIProvider, TestScopeInterpretation } from "@/server/ai/contracts";
import type { TestObjectiveScope } from "@/generated/prisma/enums";
import { db } from "@/server/db/client";
import { logError } from "@/server/observability/logger";
import { TEST_SCOPE_PROMPT_VERSION } from "@/server/prompts/test-scope";
import { AIRateLimitService } from "@/server/services/ai-rate-limit-service";
import { AIUsageService } from "@/server/services/ai-usage-service";
import { CurriculumService } from "@/server/services/curriculum-service";
import { LearningEventService } from "@/server/services/learning-event-service";
import { applyScopeRecommendations } from "@/server/services/test-plan-policy";

const defaultInterpretation: TestScopeInterpretation = {
  summary: "Wszystkie zagadnienia działu pozostają w zakresie. Sprawdź listę i zatwierdź ją przed diagnostyką.",
  expectedTaskTypes: [],
  pageRanges: [],
  objectiveRecommendations: [],
};

export class TestPlanService {
  constructor(
    private readonly ai: AIProvider,
    private readonly curriculum = new CurriculumService(),
    private readonly rateLimit = new AIRateLimitService(),
    private readonly aiUsage = new AIUsageService(),
    private readonly learningEvents = new LearningEventService(),
  ) {}

  async createDraft(studentId: string, input: {
    unitId: string;
    testDate: Date;
    dailyMinutes: number;
    teacherNote?: string;
  }) {
    const unit = await this.curriculum.getUnitForStudent(input.unitId, studentId);
    const objectives = unit.topics.flatMap((topic) => topic.objectives);
    if (!objectives.length) throw new Error("Dział nie zawiera aktywnych celów nauki.");
    const teacherNote = input.teacherNote?.trim() ?? "";
    let interpretation = defaultInterpretation;

    if (teacherNote) {
      const limit = await this.rateLimit.consume(studentId);
      if (!limit.allowed) {
        interpretation = {
          ...defaultInterpretation,
          summary: "Automatyczna interpretacja jest chwilowo niedostępna z powodu limitu użycia. Wszystkie cele pozostają w zakresie — możesz ustawić je ręcznie.",
        };
      } else {
        try {
          const result = await this.aiUsage.capture({
            studentId,
            feature: "TEST_SCOPE_PARSING",
            promptVersion: TEST_SCOPE_PROMPT_VERSION,
          }, () => this.ai.interpretTestScope({
            teacherNote,
            objectives: unit.topics.flatMap((topic) => topic.objectives.map(({ code, title, description }) => ({
              code,
              topicTitle: topic.title,
              title,
              description,
            }))),
          }));
          interpretation = result.value;
        } catch (error) {
          logError("test_scope_interpretation_failed", error, { studentId, unitId: input.unitId });
          interpretation = {
            ...defaultInterpretation,
            summary: "Nie udało się bezpiecznie zinterpretować notatki automatycznie. Niczego nie wykluczyłem — ustaw zakres ręcznie na liście poniżej.",
          };
        }
      }
    }

    const scopeRows = applyScopeRecommendations(objectives, interpretation.objectiveRecommendations);
    const plan = await db.$transaction(async (tx) => {
      await tx.testPlan.updateMany({
        where: { studentId, unitId: input.unitId, status: "DRAFT" },
        data: { status: "ARCHIVED" },
      });
      return tx.testPlan.create({
        data: {
          studentId,
          unitId: input.unitId,
          testDate: input.testDate,
          dailyMinutes: input.dailyMinutes,
          originalTeacherNote: teacherNote || null,
          interpretationSummary: interpretation.summary,
          expectedTaskTypes: interpretation.expectedTaskTypes,
          declaredPageRanges: interpretation.pageRanges,
          objectives: {
            create: scopeRows.map((row) => ({
              learningObjectiveId: row.objective.id,
              suggestedScope: row.scope,
              source: row.suggestedByAI ? "AI_SUGGESTION" : "CURRICULUM",
              reason: row.reason,
            })),
          },
        },
      });
    });
    await this.learningEvents.record({
      studentId,
      eventType: "TEST_PLAN_DRAFTED",
      metadata: { unitId: input.unitId, objectiveCount: objectives.length, usedTeacherNote: Boolean(teacherNote) },
      deduplicationKey: `test-plan-drafted:${plan.id}`,
    });
    return plan;
  }

  async getDraft(studentId: string, unitId: string) {
    return db.testPlan.findFirst({
      where: { studentId, unitId, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      include: {
        unit: true,
        objectives: {
          include: { learningObjective: { include: { topic: true } } },
          orderBy: { learningObjective: { order: "asc" } },
        },
      },
    });
  }

  async getConfirmed(studentId: string, unitId: string) {
    return db.testPlan.findFirst({
      where: { studentId, unitId, status: "CONFIRMED" },
      orderBy: { confirmedAt: "desc" },
      include: { objectives: true },
    });
  }

  async confirm(studentId: string, planId: string, scopes: Map<string, TestObjectiveScope>) {
    const plan = await db.testPlan.findFirstOrThrow({
      where: { id: planId, studentId, status: "DRAFT" },
      include: { objectives: { include: { learningObjective: true } } },
    });
    if (scopes.size !== plan.objectives.length || plan.objectives.some((row) => !scopes.has(row.learningObjectiveId))) {
      throw new Error("Zakres nie obejmuje wszystkich celów działu.");
    }
    if (![...scopes.values()].some((scope) => scope !== "EXCLUDED")) {
      throw new Error("Sprawdzian musi obejmować co najmniej jedno zagadnienie.");
    }
    const confirmedAt = new Date();
    await db.$transaction(async (tx) => {
      await tx.testPlan.updateMany({
        where: { studentId, unitId: plan.unitId, status: "CONFIRMED" },
        data: { status: "ARCHIVED" },
      });
      for (const row of plan.objectives) {
        await tx.testPlanObjective.update({
          where: { testPlanId_learningObjectiveId: { testPlanId: plan.id, learningObjectiveId: row.learningObjectiveId } },
          data: { confirmedScope: scopes.get(row.learningObjectiveId), source: "STUDENT_CONFIRMED" },
        });
      }
      await tx.testPlan.update({
        where: { id: plan.id },
        data: { status: "CONFIRMED", confirmedAt },
      });
    });
    await this.learningEvents.record({
      studentId,
      eventType: "TEST_PLAN_CONFIRMED",
      metadata: {
        unitId: plan.unitId,
        includedCount: [...scopes.values()].filter((scope) => scope !== "EXCLUDED").length,
        excludedCount: [...scopes.values()].filter((scope) => scope === "EXCLUDED").length,
        priorityCount: [...scopes.values()].filter((scope) => scope === "PRIORITY").length,
      },
      deduplicationKey: `test-plan-confirmed:${plan.id}`,
    });
    return db.testPlan.findUniqueOrThrow({ where: { id: plan.id } });
  }
}
