import type { AIResult } from "@/server/ai/contracts";

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
): AIResult {
  const reportedLearningObjectives = [...result.turn.learningObjectives];
  const reportedSourceLocators = [...result.turn.sourceLocators];
  const allowedLocators = new Set(allowedSourceLocators);
  const acceptedSourceLocators = reportedSourceLocators.filter((locator) => allowedLocators.has(locator));
  const rejectedSourceLocators = reportedSourceLocators.filter((locator) => !allowedLocators.has(locator));
  const objectiveCodesCorrected = reportedLearningObjectives.length !== 1
    || reportedLearningObjectives[0] !== expectedObjectiveCode;
  const issues = [
    ...(objectiveCodesCorrected ? ["learning_objectives_restricted_to_current"] : []),
    ...(rejectedSourceLocators.length ? ["unknown_source_locators_removed"] : []),
  ];

  return {
    ...result,
    turn: {
      ...result.turn,
      learningObjectives: [expectedObjectiveCode],
      sourceLocators: acceptedSourceLocators,
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
