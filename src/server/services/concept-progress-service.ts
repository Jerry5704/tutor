import { db } from "@/server/db/client";

function normalized(value: string) {
  return value.toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function mentions(text: string, aliases: string[]) {
  const haystack = normalized(text);
  return aliases.some((alias) => {
    const term = normalized(alias).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?<![a-z0-9])${term}(?![a-z0-9])`, "u").test(haystack);
  });
}

function targetMastery(evidenceLevel: "RECALL" | "MECHANISM" | "TRANSFER") {
  if (evidenceLevel === "TRANSFER") return 0.72;
  if (evidenceLevel === "MECHANISM") return 0.6;
  return 0.35;
}

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
    const supported = links.filter(({ concept }) => mentions(
      evidenceText,
      [concept.name, ...concept.aliases.map(({ alias }) => alias)],
    ));
    if (!supported.length) return;

    await db.$transaction(async (tx) => {
      for (const { conceptId } of supported) {
        const current = await tx.studentConceptState.findUnique({
          where: { studentId_conceptId: { studentId: params.studentId, conceptId } },
        });
        const previousMastery = current?.mastery ?? 0;
        const inferredMastery = Math.max(previousMastery, targetMastery(params.evidenceLevel));
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
