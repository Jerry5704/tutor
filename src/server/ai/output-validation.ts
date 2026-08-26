import type { AIResult } from "@/server/ai/contracts";
import type { ActiveRubric } from "@/server/services/question-bank-service";

export interface AIOutputValidationAudit {
  reportedLearningObjectives: string[];
  acceptedLearningObjectives: string[];
  reportedSourceLocators: string[];
  acceptedSourceLocators: string[];
  rejectedSourceLocators: string[];
  issues: string[];
}

export function validateTutorAIResult(
  result: AIResult,
  expectedObjectiveCode: string,
  allowedSourceLocators: string[],
  rubric?: ActiveRubric | null,
): AIResult {
  const reportedLearningObjectives = [...result.turn.learningObjectives];
  const reportedSourceLocators = [...result.turn.sourceLocators];
  const allowedLocators = new Set(allowedSourceLocators);
  const acceptedSourceLocators = reportedSourceLocators.filter((locator) => allowedLocators.has(locator));
  const rejectedSourceLocators = reportedSourceLocators.filter((locator) => !allowedLocators.has(locator));
  const acceptedConceptMentions = result.turn.conceptMentions
    .map((mention) => ({
      term: mention.term.trim(),
      sourceLocators: [...new Set(mention.sourceLocators.filter((locator) => allowedLocators.has(locator)))],
    }))
    .filter((mention, index, all) => mention.term.length >= 2
      && mention.sourceLocators.length > 0
      && all.findIndex((item) => item.term.toLocaleLowerCase("pl-PL") === mention.term.toLocaleLowerCase("pl-PL")) === index);
  const objectiveCodesCorrected = reportedLearningObjectives.length !== 1
    || reportedLearningObjectives[0] !== expectedObjectiveCode;
  const allowedCriterionCodes = new Set(rubric?.criteria.map((criterion) => criterion.code) ?? []);
  const seenCriterionCodes = new Set<string>();
  const rubricEvaluation = result.turn.rubricEvaluation.filter((evaluation) => {
    if (!allowedCriterionCodes.has(evaluation.criterionCode) || seenCriterionCodes.has(evaluation.criterionCode)) return false;
    seenCriterionCodes.add(evaluation.criterionCode);
    return true;
  });
  const missingRequiredCriteria = rubric?.criteria
    .filter((criterion) => criterion.required && !seenCriterionCodes.has(criterion.code)) ?? [];
  const unmetRequiredCriteria = rubric?.criteria.filter((criterion) => {
    if (!criterion.required) return false;
    const evaluation = rubricEvaluation.find((item) => item.criterionCode === criterion.code);
    return evaluation?.status !== "MET";
  }) ?? [];
  const rubricRestrictsCorrectness = unmetRequiredCriteria.length > 0
    && (result.turn.assessment === "CORRECT" || result.turn.assessment === "TRANSFER_DEMONSTRATED");
  const issues = [
    ...(objectiveCodesCorrected ? ["learning_objectives_restricted_to_current"] : []),
    ...(rejectedSourceLocators.length ? ["unknown_source_locators_removed"] : []),
    ...(result.turn.rubricEvaluation.length !== rubricEvaluation.length ? ["unknown_or_duplicate_rubric_criteria_removed"] : []),
    ...(missingRequiredCriteria.length ? ["required_rubric_criteria_missing"] : []),
    ...(rubricRestrictsCorrectness ? ["assessment_capped_by_required_rubric_criteria"] : []),
  ];

  return {
    ...result,
    turn: {
      ...result.turn,
      learningObjectives: [expectedObjectiveCode],
      assessment: rubricRestrictsCorrectness ? "PARTIALLY_CORRECT" : result.turn.assessment,
      sourceLocators: acceptedSourceLocators,
      conceptMentions: acceptedConceptMentions,
      rubricEvaluation,
    },
    validationAudit: {
      reportedLearningObjectives,
      acceptedLearningObjectives: [expectedObjectiveCode],
      reportedSourceLocators,
      acceptedSourceLocators,
      rejectedSourceLocators,
      issues,
    },
  };
}
