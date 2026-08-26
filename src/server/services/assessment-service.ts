import type { AIResult, KnowledgeExcerpt } from "@/server/ai/contracts";
import { PROMPT_VERSION } from "@/server/prompts/tutor";
import { db } from "@/server/db/client";
import type { ActiveRubric } from "@/server/services/question-bank-service";

type QuestionAudit = {
  questionVersionId?: string | null;
  rubric?: ActiveRubric | null;
};

export class AssessmentService {
  async record(studentId: string, answerId: string, objectiveIds: string[], result: AIResult, delta: number, knowledge: KnowledgeExcerpt[] = [], trackMasteryAttempt = true, questionAudit: QuestionAudit = {}) {
    return db.$transaction(async (tx) => {
      const updated = [];
      const appliedDelta = trackMasteryAttempt ? delta : 0;
      const objectiveAudit = [];
      for (const objectiveId of objectiveIds) {
        const current = await tx.studentMastery.findUnique({ where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } } });
        const masteryBefore = current?.mastery ?? 0;
        const confidenceBefore = current?.confidence ?? 0;
        const mastery = Math.max(0, Math.min(1, masteryBefore + appliedDelta));
        const row = trackMasteryAttempt
          ? await tx.studentMastery.upsert({
              where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } },
              create: { studentId, learningObjectiveId: objectiveId, mastery, confidence: delta > 0 ? 0.3 : 0.1, attempts: 1, lastPracticedAt: new Date() },
              update: { mastery, confidence: Math.max(0, Math.min(1, (current?.confidence ?? 0) + (delta > 0 ? 0.08 : -0.04))), attempts: { increment: 1 }, lastPracticedAt: new Date() },
            })
          : current ?? await tx.studentMastery.create({
              data: { studentId, learningObjectiveId: objectiveId, mastery: 0, confidence: 0, attempts: 0 },
            });
        updated.push(row);
        objectiveAudit.push({
          learningObjectiveId: objectiveId,
          masteryBefore,
          masteryAfter: row.mastery,
          confidenceBefore,
          confidenceAfter: row.confidence,
        });
      }
      const misconceptions = await Promise.all(result.turn.misconceptions.map((code) => tx.misconception.upsert({
        where: { code }, create: { code, description: code.replaceAll("_", " ") }, update: {},
      })));
      const criterionResults = questionAudit.rubric?.criteria.flatMap((criterion) => {
        const evaluation = result.turn.rubricEvaluation.find((item) => item.criterionCode === criterion.code);
        if (!evaluation) return [];
        const awardedPoints = criterion.points === null
          ? null
          : evaluation.status === "MET" ? criterion.points : evaluation.status === "PARTIALLY_MET" ? criterion.points / 2 : 0;
        return [{
          rubricCriterionId: criterion.id,
          status: evaluation.status,
          evidence: evaluation.evidence,
          awardedPoints,
        }];
      }) ?? [];
      const rubricMaxPoints = questionAudit.rubric?.maxPoints
        ?? (questionAudit.rubric?.criteria.some((criterion) => criterion.points !== null)
          ? questionAudit.rubric.criteria.reduce((sum, criterion) => sum + (criterion.points ?? 0), 0)
          : null);
      const rubricEarnedPoints = rubricMaxPoints === null
        ? null
        : criterionResults.reduce((sum, criterion) => sum + (criterion.awardedPoints ?? 0), 0);
      const assessment = await tx.assessment.create({ data: {
        studentAnswerId: answerId,
        rating: result.turn.assessment,
        studentIntent: result.turn.studentIntent,
        evidenceLevel: result.turn.evidenceLevel,
        masteryDelta: appliedDelta,
        proposedMasteryDelta: delta,
        nextAction: result.turn.nextAction, rationale: result.turn.rationale,
        providerResponseId: result.responseId, model: result.model, promptVersion: PROMPT_VERSION,
        latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        questionVersionId: questionAudit.questionVersionId,
        questionRubricId: questionAudit.rubric?.id,
        rubricEarnedPoints,
        rubricMaxPoints,
        knowledgeLocators: {
          retrieved: knowledge.map(({ sourceId, locator }) => ({ sourceId, locator })),
          citedByModel: result.validationAudit?.reportedSourceLocators ?? result.turn.sourceLocators,
          acceptedCitations: result.turn.sourceLocators,
          reportedLearningObjectives: result.validationAudit?.reportedLearningObjectives ?? result.turn.learningObjectives,
          acceptedLearningObjectives: result.turn.learningObjectives,
          validationIssues: result.validationAudit?.issues ?? [],
        },
        objectives: { create: objectiveAudit },
        misconceptions: { create: misconceptions.map((item) => ({ misconceptionId: item.id })) },
        criterionResults: { create: criterionResults },
      } });
      return { masteries: updated, assessmentId: assessment.id };
    });
  }
}
