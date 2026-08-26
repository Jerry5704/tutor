import type { QuestionPurpose } from "@/generated/prisma/enums";
import { db } from "@/server/db/client";

export type ActiveRubric = {
  id: string;
  stableKey: string;
  title: string;
  sourceType: "CKE_EXACT" | "CKE_DERIVED" | "TEACHER_SPECIFIC" | "CURRICULUM_DERIVED" | "INTERNAL_LEARNING";
  scoringMode: "LEARNING_EVIDENCE" | "EXAM_POINTS";
  sourceLocator: string | null;
  sourceVersion: string | null;
  maxPoints: number | null;
  criteria: Array<{
    id: string;
    code: string;
    description: string;
    required: boolean;
    points: number | null;
    evidenceLevel: string;
  }>;
};

export type SelectedQuestion = {
  id: string;
  stableKey: string;
  version: number;
  prompt: string;
  purpose: QuestionPurpose;
  evidenceLevel: string;
  sourceType: ActiveRubric["sourceType"];
  sourceLocator: string | null;
  sourceVersion: string | null;
  rubric: ActiveRubric | null;
};

const rubricPriority: Record<ActiveRubric["sourceType"], number> = {
  CKE_EXACT: 0,
  CKE_DERIVED: 1,
  CURRICULUM_DERIVED: 2,
  INTERNAL_LEARNING: 3,
  TEACHER_SPECIFIC: 4,
};

export class QuestionBankService {
  async rubric(rubricId?: string | null): Promise<ActiveRubric | null> {
    if (!rubricId) return null;
    const rubric = await db.questionRubric.findUnique({
      where: { id: rubricId },
      include: { criteria: { orderBy: { code: "asc" } } },
    });
    if (rubric?.status !== "APPROVED") return null;
    return {
      id: rubric.id,
      stableKey: rubric.stableKey,
      title: rubric.title,
      sourceType: rubric.sourceType,
      scoringMode: rubric.scoringMode,
      sourceLocator: rubric.sourceLocator,
      sourceVersion: rubric.sourceVersion,
      maxPoints: rubric.maxPoints,
      criteria: rubric.criteria.map((criterion) => ({
        id: criterion.id,
        code: criterion.code,
        description: criterion.description,
        required: criterion.required,
        points: criterion.points,
        evidenceLevel: criterion.evidenceLevel,
      })),
    };
  }

  async select(params: {
    sessionId: string;
    learningObjectiveId: string;
    purpose: QuestionPurpose;
    testPlanId?: string | null;
  }): Promise<SelectedQuestion | null> {
    const questions = await db.questionItemVersion.findMany({
      where: {
        purpose: params.purpose,
        status: "APPROVED",
        objectives: { some: { learningObjectiveId: params.learningObjectiveId } },
      },
      include: {
        rubrics: {
          where: {
            status: "APPROVED",
            OR: [
              { testPlanId: null },
              ...(params.testPlanId ? [{ testPlanId: params.testPlanId }] : []),
            ],
          },
          include: { criteria: { orderBy: { code: "asc" } } },
        },
      },
      orderBy: [{ difficulty: "asc" }, { stableKey: "asc" }, { version: "desc" }],
    });
    if (!questions.length) return null;

    const used = await db.tutorMessage.findMany({
      where: {
        sessionId: params.sessionId,
        questionVersionId: { in: questions.map((question) => question.id) },
      },
      select: { questionVersionId: true },
    });
    const usedIds = new Set(used.flatMap((message) => message.questionVersionId ? [message.questionVersionId] : []));
    const selected = questions.find((question) => !usedIds.has(question.id)) ?? questions[0];

    const baseRubrics = selected.rubrics
      .filter((rubric) => rubric.sourceType !== "TEACHER_SPECIFIC" && rubric.testPlanId === null)
      .sort((left, right) => rubricPriority[left.sourceType] - rubricPriority[right.sourceType]);
    const rubric = baseRubrics[0] ?? null;

    return {
      id: selected.id,
      stableKey: selected.stableKey,
      version: selected.version,
      prompt: selected.prompt,
      purpose: selected.purpose,
      evidenceLevel: selected.evidenceLevel,
      sourceType: selected.sourceType,
      sourceLocator: selected.sourceLocator,
      sourceVersion: selected.sourceVersion,
      rubric: rubric ? {
        id: rubric.id,
        stableKey: rubric.stableKey,
        title: rubric.title,
        sourceType: rubric.sourceType,
        scoringMode: rubric.scoringMode,
        sourceLocator: rubric.sourceLocator,
        sourceVersion: rubric.sourceVersion,
        maxPoints: rubric.maxPoints,
        criteria: rubric.criteria.map((criterion) => ({
          id: criterion.id,
          code: criterion.code,
          description: criterion.description,
          required: criterion.required,
          points: criterion.points,
          evidenceLevel: criterion.evidenceLevel,
        })),
      } : null,
    };
  }
}
