import assert from "node:assert/strict";
import test from "node:test";
import type { MockExamGrading } from "@/server/ai/contracts";
import { examAwareReadiness, scoreMockExam, selectMockQuestionIds } from "@/server/services/mock-exam-policy";

const questions = [{
  id: "q1",
  maxPoints: 2,
  objectiveIds: ["o1"],
  allowedSourceLocators: ["book-page:1"],
  criteria: [
    { id: "c1", code: "first", points: 1 },
    { id: "c2", code: "second", points: 1 },
  ],
}];

function grading(criteria: MockExamGrading["answers"][number]["criteria"]): MockExamGrading {
  return {
    answers: [{
      questionId: "q1",
      assessment: "CORRECT",
      feedback: "Sprawdzono odpowiedź.",
      sourceLocators: ["book-page:1", "invented"],
      criteria,
    }],
    overallSummary: "Podsumowanie.",
  };
}

test("mock exam points are computed from controlled criteria, not model assessment", () => {
  const result = scoreMockExam(questions, grading([
    { criterionCode: "first", status: "MET", evidence: "Jest." },
    { criterionCode: "second", status: "NOT_MET", evidence: "Brak." },
  ]));
  assert.equal(result.score, 1);
  assert.equal(result.percentage, 50);
  assert.equal(result.answers[0]?.assessment, "PARTIALLY_CORRECT");
  assert.deepEqual(result.answers[0]?.sourceLocators, ["book-page:1"]);
});

test("missing and invented criterion results never award points", () => {
  const result = scoreMockExam(questions, grading([
    { criterionCode: "invented", status: "MET", evidence: "Nieznane." },
    { criterionCode: "first", status: "MET", evidence: "Jest." },
  ]));
  assert.equal(result.score, 1);
  assert.equal(result.answers[0]?.criteria.find((item) => item.criterionCode === "second")?.status, "NOT_MET");
});

test("a partially met binary exam criterion does not invent half a point", () => {
  const result = scoreMockExam(questions, grading([
    { criterionCode: "first", status: "PARTIALLY_MET", evidence: "Tylko część." },
    { criterionCode: "second", status: "MET", evidence: "Jest." },
  ]));
  assert.equal(result.score, 1);
  assert.equal(result.answers[0]?.criteria[0]?.awardedPoints, 0);
});

test("objective result aggregates only questions linked to that objective", () => {
  const result = scoreMockExam(questions, grading([
    { criterionCode: "first", status: "MET", evidence: "Jest." },
    { criterionCode: "second", status: "MET", evidence: "Jest." },
  ]));
  assert.deepEqual(result.objectives, [{ learningObjectiveId: "o1", earnedPoints: 2, maxPoints: 2, percentage: 100 }]);
});

test("exam-aware readiness keeps mastery alone until an exam exists", () => {
  assert.equal(examAwareReadiness(80), 80);
  assert.equal(examAwareReadiness(80, 50), 68);
  assert.equal(examAwareReadiness(120, -10), 60);
});

test("mock question selection interleaves objectives and never duplicates a shared question", () => {
  const result = selectMockQuestionIds(["o1", "o2"], [
    { id: "q1", objectiveIds: ["o1"] },
    { id: "q2", objectiveIds: ["o2"] },
    { id: "q3", objectiveIds: ["o1", "o2"] },
    { id: "q4", objectiveIds: ["o2"] },
  ]);
  assert.deepEqual(result.selectedIds, ["q1", "q2", "q3", "q4"]);
  assert.deepEqual(result.missingObjectiveIds, []);
});

test("mock question selection reports an objective without complete coverage", () => {
  const result = selectMockQuestionIds(["o1"], [{ id: "q1", objectiveIds: ["o1"] }]);
  assert.deepEqual(result.selectedIds, ["q1"]);
  assert.deepEqual(result.missingObjectiveIds, ["o1"]);
});
