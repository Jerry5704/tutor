export type LearningTransition = "CONTINUE" | "ASK_TRANSFER" | "MASTER" | "SHOW_WORKED_EXAMPLE" | "ROTATE_OBJECTIVE";

export function learningTransition(params: {
  understood: boolean;
  learningStep: "EXPLAIN" | "PRACTICE" | "TRANSFER";
  mastery: number;
  consecutiveStruggles: number;
  workedExamplesShown: number;
}): LearningTransition {
  if (params.understood && params.learningStep === "PRACTICE") return "ASK_TRANSFER";
  if (params.understood && params.learningStep === "TRANSFER" && params.mastery >= OBJECTIVE_MASTERY_THRESHOLD) return "MASTER";
  if (!params.understood && params.consecutiveStruggles >= 2) {
    return params.workedExamplesShown === 0 ? "SHOW_WORKED_EXAMPLE" : "ROTATE_OBJECTIVE";
  }
  return "CONTINUE";
}

export function finishesDiagnosticProbe(params: {
  understood: boolean;
  forceExplanation: boolean;
  studentIntent: string;
  diagnosticAttempts: number;
}) {
  return params.understood
    || params.forceExplanation
    || params.studentIntent === "UNCERTAIN"
    || params.diagnosticAttempts >= 2;
}
import { OBJECTIVE_MASTERY_THRESHOLD } from "@/server/services/readiness-policy";
