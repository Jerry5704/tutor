import { db } from "@/server/db/client";
import { conceptMasteryTarget, explicitlySupportedConceptIds } from "@/server/services/concept-evidence-policy";

export class ConceptProgressService {
  async recordObjectiveEvidence(params: {
    studentId: string;
    learningObjectiveId: string;
    assessmentId: string;
    evidenceLevel: "RECALL" | "MECHANISM" | "TRANSFER";
    question: string;
    answer: string;
  }) {
    const links = await db.conceptObjective.findMany({
      where: { learningObjectiveId: params.learningObjectiveId },
      include: { concept: { include: { aliases: true } } },
    });
    const evidenceText = `${params.question}\n${params.answer}`;
    const supportedIds = new Set(explicitlySupportedConceptIds(evidenceText, links.map(({ concept }) => ({
      id: concept.id,
      name: concept.name,
      aliases: concept.aliases.map(({ alias }) => alias),
    }))));
    const supported = links.filter(({ conceptId }) => supportedIds.has(conceptId));
    if (!supported.length) return;

    await db.$transaction(async (tx) => {
      for (const { conceptId } of supported) {
        const current = await tx.studentConceptState.findUnique({
          where: { studentId_conceptId: { studentId: params.studentId, conceptId } },
        });
        const previousMastery = current?.mastery ?? 0;
        const inferredMastery = Math.max(previousMastery, conceptMasteryTarget(params.evidenceLevel));
        await tx.studentConceptState.upsert({
          where: { studentId_conceptId: { studentId: params.studentId, conceptId } },
          create: {
            studentId: params.studentId,
            conceptId,
            mastery: inferredMastery,
            confidence: 0.2,
            attempts: 1,
            evidenceCount: 1,
            lastPracticedAt: new Date(),
          },
          update: {
            mastery: inferredMastery,
            confidence: Math.min(1, (current?.confidence ?? 0) + 0.08),
            attempts: { increment: 1 },
            evidenceCount: { increment: 1 },
            lastPracticedAt: new Date(),
          },
        });
        await tx.conceptEvidence.create({
          data: {
            studentId: params.studentId,
            conceptId,
            assessmentId: params.assessmentId,
            learningObjectiveId: params.learningObjectiveId,
            evidenceLevel: params.evidenceLevel,
            masteryBefore: previousMastery,
            masteryAfter: inferredMastery,
          },
        });
      }
    });
  }
}
