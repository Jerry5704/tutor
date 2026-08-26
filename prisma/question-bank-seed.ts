import type { PrismaClient } from "../src/generated/prisma/client";

type SeedClient = Pick<PrismaClient, "questionItemVersion" | "questionObjective" | "questionRubric" | "rubricCriterion">;

type ObjectiveForQuestionBank = {
  id: string;
  code: string;
  description: string;
  diagnosticPrompt: string;
  practicePrompt: string;
  transferPrompt: string;
};

export async function syncBaselineQuestionBank(db: SeedClient, objective: ObjectiveForQuestionBank) {
  const definitions = [
    { purpose: "DIAGNOSTIC" as const, suffix: "diagnostic", prompt: objective.diagnosticPrompt, evidenceLevel: "MECHANISM", difficulty: 1, sourceType: "CURRICULUM_DERIVED" as const },
    { purpose: "PRACTICE" as const, suffix: "practice", prompt: objective.practicePrompt, evidenceLevel: "MECHANISM", difficulty: 2, sourceType: "INTERNAL_LEARNING" as const },
    { purpose: "TRANSFER" as const, suffix: "transfer", prompt: objective.transferPrompt, evidenceLevel: "TRANSFER", difficulty: 3, sourceType: "INTERNAL_LEARNING" as const },
  ];

  for (const definition of definitions) {
    const stableKey = `${objective.code}:${definition.suffix}`;
    const question = await db.questionItemVersion.upsert({
      where: { stableKey_version: { stableKey, version: 1 } },
      update: {
        prompt: definition.prompt,
        purpose: definition.purpose,
        evidenceLevel: definition.evidenceLevel,
        difficulty: definition.difficulty,
        status: "APPROVED",
        sourceType: definition.sourceType,
        sourceLocator: `learning-objective:${objective.code}`,
        sourceVersion: "baseline-v1",
      },
      create: {
        stableKey,
        version: 1,
        prompt: definition.prompt,
        purpose: definition.purpose,
        evidenceLevel: definition.evidenceLevel,
        difficulty: definition.difficulty,
        status: "APPROVED",
        sourceType: definition.sourceType,
        sourceLocator: `learning-objective:${objective.code}`,
        sourceVersion: "baseline-v1",
      },
    });
    await db.questionObjective.upsert({
      where: { questionVersionId_learningObjectiveId: { questionVersionId: question.id, learningObjectiveId: objective.id } },
      update: { importance: 1 },
      create: { questionVersionId: question.id, learningObjectiveId: objective.id, importance: 1 },
    });
    const rubricStableKey = `${stableKey}:rubric`;
    const rubric = await db.questionRubric.upsert({
      where: { stableKey_version: { stableKey: rubricStableKey, version: 1 } },
      update: {
        questionVersionId: question.id,
        title: "Kryteria odpowiedzi na pytanie",
        sourceType: definition.sourceType,
        scoringMode: "LEARNING_EVIDENCE",
        status: "APPROVED",
        sourceLocator: `learning-objective:${objective.code}`,
        sourceVersion: "baseline-v1",
        maxPoints: 1,
      },
      create: {
        stableKey: rubricStableKey,
        version: 1,
        questionVersionId: question.id,
        title: "Kryteria odpowiedzi na pytanie",
        sourceType: definition.sourceType,
        scoringMode: "LEARNING_EVIDENCE",
        status: "APPROVED",
        sourceLocator: `learning-objective:${objective.code}`,
        sourceVersion: "baseline-v1",
        maxPoints: 1,
      },
    });
    await db.rubricCriterion.upsert({
      where: { questionRubricId_code: { questionRubricId: rubric.id, code: "answers_asked_question" } },
      update: {
        description: `Odpowiedź poprawnie i rzeczowo realizuje wszystkie elementy polecenia: ${definition.prompt}`,
        evidenceLevel: definition.evidenceLevel,
      },
      create: {
        questionRubricId: rubric.id,
        code: "answers_asked_question",
        description: `Odpowiedź poprawnie i rzeczowo realizuje wszystkie elementy polecenia: ${definition.prompt}`,
        required: true,
        points: 1,
        evidenceLevel: definition.evidenceLevel,
      },
    });
  }
}
