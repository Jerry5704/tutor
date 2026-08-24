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
      conceptMentions: acceptedConceptMentions,
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
