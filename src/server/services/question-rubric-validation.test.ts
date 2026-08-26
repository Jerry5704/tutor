import assert from "node:assert/strict";
import test from "node:test";
import type { AIResult } from "@/server/ai/contracts";
import { validateTutorAIResult } from "@/server/ai/output-validation";
import type { ActiveRubric } from "@/server/services/question-bank-service";

const rubric: ActiveRubric = {
  id: "rubric-1",
  stableKey: "objective:practice:rubric",
  title: "Kryteria odpowiedzi",
  sourceType: "CURRICULUM_DERIVED",
  scoringMode: "LEARNING_EVIDENCE",
  sourceLocator: "learning-objective:objective",
  sourceVersion: "v1",
  maxPoints: 1,
  criteria: [{
    id: "criterion-1",
    code: "mechanism",
    description: "Uczeń wyjaśnia mechanizm.",
    required: true,
    points: 1,
    evidenceLevel: "MECHANISM",
  }],
};

function result(rubricEvaluation: AIResult["turn"]["rubricEvaluation"]): AIResult {
  return {
    turn: {
      feedback: "Dobrze.",
      nextQuestion: null,
      studentIntent: "ANSWER",
      assessment: "CORRECT",
      evidenceLevel: "MECHANISM",
      misconceptions: [],
      learningObjectives: ["objective"],
      nextAction: "NEXT_OBJECTIVE",
      rationale: "Odpowiedź oceniona.",
      sourceLocators: [],
      conceptMentions: [],
      rubricEvaluation,
    },
    responseId: "response-1",
    model: "test-model",
    latencyMs: 1,
  };
}

test("required rubric criterion caps an unsupported correct assessment", () => {
  const validated = validateTutorAIResult(result([{
    criterionCode: "mechanism",
    status: "NOT_MET",
    evidence: "Brak mechanizmu w odpowiedzi.",
  }]), "objective", [], rubric);

  assert.equal(validated.turn.assessment, "PARTIALLY_CORRECT");
  assert.ok(validated.validationAudit?.issues.includes("assessment_capped_by_required_rubric_criteria"));
});

test("unknown rubric criteria are removed without replacing required criteria", () => {
  const validated = validateTutorAIResult(result([{
    criterionCode: "invented",
    status: "MET",
    evidence: "Nieistniejące kryterium.",
  }]), "objective", [], rubric);

  assert.deepEqual(validated.turn.rubricEvaluation, []);
  assert.equal(validated.turn.assessment, "PARTIALLY_CORRECT");
  assert.ok(validated.validationAudit?.issues.includes("unknown_or_duplicate_rubric_criteria_removed"));
  assert.ok(validated.validationAudit?.issues.includes("required_rubric_criteria_missing"));
});

test("meeting the controlled criterion preserves a correct assessment", () => {
  const validated = validateTutorAIResult(result([{
    criterionCode: "mechanism",
    status: "MET",
    evidence: "Uczeń podał związek przyczynowy.",
  }]), "objective", [], rubric);

  assert.equal(validated.turn.assessment, "CORRECT");
  assert.equal(validated.turn.rubricEvaluation[0]?.criterionCode, "mechanism");
});
