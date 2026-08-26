import type { MockExamGrading } from "@/server/ai/contracts";

export const MOCK_REMEDIATION_THRESHOLD = 80;
export const REQUIRED_MOCK_QUESTIONS_PER_OBJECTIVE = 2;

export function mockQuestionsPerObjectiveForAttempt(objectiveCount: number) {
  return objectiveCount <= 2 ? 2 : 1;
}

export function selectMockQuestionIds(
  objectiveIds: string[],
  questions: Array<{ id: string; objectiveIds: string[] }>,
  perObjective = 2,
  variantOffset = 0,
) {
  const selected: string[] = [];
  const selectedIds = new Set<string>();
  const missingObjectiveIds = new Set<string>();
  for (let round = 0; round < perObjective; round += 1) {
    for (const objectiveId of objectiveIds) {
      const candidates = questions.filter((question) => !selectedIds.has(question.id) && question.objectiveIds.includes(objectiveId));
      const candidate = candidates.length ? candidates[variantOffset % candidates.length] : undefined;
      if (!candidate) {
        missingObjectiveIds.add(objectiveId);
        continue;
      }
      selected.push(candidate.id);
      selectedIds.add(candidate.id);
    }
  }
  return { selectedIds: selected, missingObjectiveIds: [...missingObjectiveIds] };
}

export type MockQuestionForScoring = {
  id: string;
  maxPoints: number;
  objectiveIds: string[];
  allowedSourceLocators: string[];
  criteria: Array<{ id: string; code: string; points: number }>;
};

export type ScoredMockAnswer = {
  questionId: string;
  assessment: "INCORRECT" | "PARTIALLY_CORRECT" | "CORRECT" | "TRANSFER_DEMONSTRATED";
  feedback: string;
  sourceLocators: string[];
  earnedPoints: number;
  maxPoints: number;
  criteria: Array<{
    criterionId: string;
    criterionCode: string;
    status: "MET" | "PARTIALLY_MET" | "NOT_MET" | "CONTRADICTED";
    evidence: string;
    awardedPoints: number;
  }>;
};

function awarded(points: number, status: ScoredMockAnswer["criteria"][number]["status"]) {
  if (status === "MET") return points;
  return 0;
}

export function scoreMockExam(questions: MockQuestionForScoring[], grading: MockExamGrading) {
  const rawByQuestion = new Map<string, MockExamGrading["answers"][number]>();
  for (const answer of grading.answers) {
    if (!questions.some((question) => question.id === answer.questionId) || rawByQuestion.has(answer.questionId)) continue;
    rawByQuestion.set(answer.questionId, answer);
  }

  const answers: ScoredMockAnswer[] = questions.map((question) => {
    const raw = rawByQuestion.get(question.id);
    const rawCriteria = new Map<string, NonNullable<typeof raw>["criteria"][number]>();
    for (const criterion of raw?.criteria ?? []) {
      if (!question.criteria.some((known) => known.code === criterion.criterionCode) || rawCriteria.has(criterion.criterionCode)) continue;
      rawCriteria.set(criterion.criterionCode, criterion);
    }
    const criteria = question.criteria.map((criterion) => {
      const result = rawCriteria.get(criterion.code);
      const status = result?.status ?? "NOT_MET";
      return {
        criterionId: criterion.id,
        criterionCode: criterion.code,
        status,
        evidence: result?.evidence.trim() || "Brak potwierdzenia kryterium w odpowiedzi.",
        awardedPoints: awarded(criterion.points, status),
      };
    });
    const earnedPoints = criteria.reduce((sum, criterion) => sum + criterion.awardedPoints, 0);
    const assessment = earnedPoints <= 0
      ? "INCORRECT" as const
      : earnedPoints < question.maxPoints
        ? "PARTIALLY_CORRECT" as const
        : "TRANSFER_DEMONSTRATED" as const;
    const allowedLocators = new Set(question.allowedSourceLocators);
    return {
      questionId: question.id,
      assessment,
      feedback: raw?.feedback.trim() || "Nie udało się potwierdzić elementów wymaganych w tym zadaniu.",
      sourceLocators: [...new Set((raw?.sourceLocators ?? []).filter((locator) => allowedLocators.has(locator)))],
      earnedPoints,
      maxPoints: question.maxPoints,
      criteria,
    };
  });

  const objectiveTotals = new Map<string, { earnedPoints: number; maxPoints: number }>();
  for (const answer of answers) {
    const question = questions.find((item) => item.id === answer.questionId);
    for (const objectiveId of question?.objectiveIds ?? []) {
      const current = objectiveTotals.get(objectiveId) ?? { earnedPoints: 0, maxPoints: 0 };
      current.earnedPoints += answer.earnedPoints;
      current.maxPoints += answer.maxPoints;
      objectiveTotals.set(objectiveId, current);
    }
  }
  const objectives = [...objectiveTotals].map(([learningObjectiveId, result]) => ({
    learningObjectiveId,
    ...result,
    percentage: result.maxPoints > 0 ? Math.round((result.earnedPoints / result.maxPoints) * 100) : 0,
  }));
  const score = answers.reduce((sum, answer) => sum + answer.earnedPoints, 0);
  const maxScore = answers.reduce((sum, answer) => sum + answer.maxPoints, 0);
  return {
    answers,
    objectives,
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    overallSummary: grading.overallSummary.trim(),
  };
}

export function examAwareReadiness(masteryReadiness: number, latestExamPercentage?: number | null) {
  const boundedMastery = Math.max(0, Math.min(100, masteryReadiness));
  if (latestExamPercentage === null || latestExamPercentage === undefined) return Math.round(boundedMastery);
  const boundedExam = Math.max(0, Math.min(100, latestExamPercentage));
  return Math.round(boundedMastery * 0.6 + boundedExam * 0.4);
}
