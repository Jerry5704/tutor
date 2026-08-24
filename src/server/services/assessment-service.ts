import type { AIResult, KnowledgeExcerpt } from "@/server/ai/contracts";
import { PROMPT_VERSION } from "@/server/prompts/tutor";
import { db } from "@/server/db/client";

export class AssessmentService {
  async record(studentId: string, answerId: string, objectiveIds: string[], result: AIResult, delta: number, knowledge: KnowledgeExcerpt[] = [], trackMasteryAttempt = true) {
    return db.$transaction(async (tx) => {
      const updated = [];
      for (const objectiveId of objectiveIds) {
        const current = await tx.studentMastery.findUnique({ where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } } });
        const mastery = Math.max(0, Math.min(1, (current?.mastery ?? 0) + delta));
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
      }
      const misconceptions = await Promise.all(result.turn.misconceptions.map((code) => tx.misconception.upsert({
        where: { code }, create: { code, description: code.replaceAll("_", " ") }, update: {},
      })));
      const assessment = await tx.assessment.create({ data: {
        studentAnswerId: answerId, rating: result.turn.assessment, masteryDelta: delta,
        nextAction: result.turn.nextAction, rationale: result.turn.rationale,
        providerResponseId: result.responseId, model: result.model, promptVersion: PROMPT_VERSION,
        latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        knowledgeLocators: {
          retrieved: knowledge.map(({ sourceId, locator }) => ({ sourceId, locator })),
          citedByModel: result.validationAudit?.reportedSourceLocators ?? result.turn.sourceLocators,
          acceptedCitations: result.turn.sourceLocators,
          reportedLearningObjectives: result.validationAudit?.reportedLearningObjectives ?? result.turn.learningObjectives,
          acceptedLearningObjectives: result.turn.learningObjectives,
          validationIssues: result.validationAudit?.issues ?? [],
        },
        objectives: { create: objectiveIds.map((learningObjectiveId) => ({ learningObjectiveId })) },
        misconceptions: { create: misconceptions.map((item) => ({ misconceptionId: item.id })) },
      } });
      return { masteries: updated, assessmentId: assessment.id };
    });
  }
}
