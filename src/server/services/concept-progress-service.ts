import { db } from "@/server/db/client";

export class ConceptProgressService {
  async recordObjectiveEvidence(studentId: string, learningObjectiveId: string, objectiveMastery: number) {
    const links = await db.conceptObjective.findMany({
      where: { learningObjectiveId },
      select: { conceptId: true },
    });

    await db.$transaction(async (tx) => {
      for (const { conceptId } of links) {
        const current = await tx.studentConceptState.findUnique({
          where: { studentId_conceptId: { studentId, conceptId } },
        });
        const inferredMastery = Math.min(0.78, objectiveMastery * 0.6);
        await tx.studentConceptState.upsert({
          where: { studentId_conceptId: { studentId, conceptId } },
          create: {
            studentId,
            conceptId,
            mastery: inferredMastery,
            confidence: 0.2,
            attempts: 1,
            evidenceCount: 1,
            lastPracticedAt: new Date(),
          },
          update: {
            mastery: Math.max(current?.mastery ?? 0, inferredMastery),
            confidence: Math.min(1, (current?.confidence ?? 0) + 0.08),
            attempts: { increment: 1 },
            evidenceCount: { increment: 1 },
            lastPracticedAt: new Date(),
          },
        });
      }
    });
  }
}
