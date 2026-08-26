import type { TutorTurn } from "@/server/ai/contracts";

export const PRE_TRANSFER_MASTERY_CEILING = 0.74;

export function learningStepAfterDiagnostic(mastery: number, diagnosticAttempts: number) {
  if (diagnosticAttempts <= 0 || mastery < 0.3) return "EXPLAIN" as const;
  if (mastery < 0.6) return "PRACTICE" as const;
  return "TRANSFER" as const;
}

export function learningPlanAfterDiagnostic(
  objectiveIds: string[],
  evidence: Array<{ learningObjectiveId: string; mastery: number; diagnosticAttempts: number; mastered: boolean }>,
) {
  const byObjective = new Map(evidence.map((item) => [item.learningObjectiveId, item]));
  const objectives = objectiveIds.map((learningObjectiveId) => {
    const item = byObjective.get(learningObjectiveId);
    return {
      learningObjectiveId,
      mastery: item?.mastery ?? 0,
      mastered: item?.mastered ?? false,
      learningStep: learningStepAfterDiagnostic(item?.mastery ?? 0, item?.diagnosticAttempts ?? 0),
    };
  });
  const nextObjectiveId = objectives
    .filter((objective) => !objective.mastered)
    .toSorted((left, right) => left.mastery - right.mastery)[0]?.learningObjectiveId;
  return { objectives, nextObjectiveId };
}

export function capDeltaBeforeTransfer(currentMastery: number, proposedDelta: number) {
  if (proposedDelta <= 0) return proposedDelta;
  const capped = Math.min(proposedDelta, Math.max(0, PRE_TRANSFER_MASTERY_CEILING - currentMastery));
  return Math.round(capped * 1000) / 1000;
}

export function capMasteryBeforeTransfer(mastery: number) {
  return Math.min(PRE_TRANSFER_MASTERY_CEILING, mastery);
}

const helpPatterns = [
  /\bnie mam pojęcia\b/i,
  /\b(powiedz|napisz|wyjaśnij|wytłumacz)\b.*\b(mi|proszę)?\b/i,
  /\bty mi (napisz|powiedz|wyjaśnij|wytłumacz)\b/i,
  /\bnie rozumiem\b/i,
  /\bpytasz (mnie )?o to samo\b/i,
  /\b(jaka|co) (jest|będzie) (poprawna )?odpowiedź/i,
  /\bjaka jest odpowiedź na\b/i,
  /\bpodaj (mi )?(poprawną )?odpowiedź/i,
];

export function explicitlyRequestsHelp(answer: string) {
  const normalized = answer.trim();
  if (helpPatterns.some((pattern) => pattern.test(normalized))) return true;
  if (!/\bnie wiem\b/iu.test(normalized)) return false;
  const words = normalized.split(/\s+/gu).filter(Boolean);
  const substantiveAttempt = /\b(ale|jednak)\b.{25,}/iu.test(normalized) || words.length >= 18;
  return !substantiveAttempt;
}

export function requestsBulkDiagnosticSkip(answer: string) {
  const normalized = answer.toLocaleLowerCase("pl-PL").replace(/\s+/g, " ").trim();
  const globalScope = /(wsz(y|ę)d|wszystk|cał(y|ego)|reszt|kolejn|przyszł|ten dział)/u.test(normalized);
  const noKnowledge = /(nie wiem|nie znam|nie umiem|nie (jestem|byłem) zaznajomion|nic nie wiem)/u.test(normalized);
  const automation = /(automatycz|pomiń|przejdź|oznacz|odpuść|bez diagnostyki)/u.test(normalized);
  return noKnowledge && globalScope && automation;
}

export function asksForClarification(answer: string) {
  const normalized = answer.toLocaleLowerCase("pl-PL").replace(/\s+/g, " ").trim();
  return /(co (to|znaczy)|czym jest|co oznacza|jak[aie]? .+ mam|jak to sobie wyobrazić|nie rozumiem (słowa|pojęcia|pytania)|pytani[ae] o samo pytanie)/u.test(normalized);
}

export function confirmsUnderstanding(answer: string) {
  const normalized = answer.toLocaleLowerCase("pl-PL").replace(/\s+/g, " ").trim();
  if (normalized.includes("?") || /\b(ale|trochę|troche|nie do końca|nie rozumiem|nie wiem|chyba)\b/u.test(normalized)) return false;
  return /^(tak|tak,|jasne|już jasne|rozumiem|już rozumiem|ogarniam|wystarcza|to wystarcza|to wystarczy|mozemy|możemy|dalej|idziemy dalej|ok|okej)(\b|[.!])/u.test(normalized);
}

export function challengeFor(mastery: number): "RECALL" | "MECHANISM" | "TRANSFER" {
  if (mastery >= 0.7) return "TRANSFER";
  if (mastery >= 0.3) return "MECHANISM";
  return "RECALL";
}

export function masteryDelta(turn: TutorTurn, scaffoldLevel: number, forceExplanation: boolean) {
  if (forceExplanation || turn.studentIntent !== "ANSWER" || turn.evidenceLevel === "NONE") return 0;

  const base = {
    INCORRECT: -0.03,
    PARTIALLY_CORRECT: 0.04,
    CORRECT: 0.1,
    TRANSFER_DEMONSTRATED: 0.16,
  }[turn.assessment];
  const evidenceMultiplier = { NONE: 0, RECALL: 0.7, MECHANISM: 1, TRANSFER: 1.15 }[turn.evidenceLevel];
  const supportMultiplier = Math.max(0.35, 1 - scaffoldLevel * 0.15);
  return Math.round(base * evidenceMultiplier * supportMultiplier * 1000) / 1000;
}

export function diagnosticMasteryDelta(currentMastery: number, turn: TutorTurn, forceExplanation: boolean) {
  if (forceExplanation || turn.studentIntent !== "ANSWER" || turn.evidenceLevel === "NONE") {
    return 0;
  }
  const targets = {
    INCORRECT: { RECALL: 0.05, MECHANISM: 0.05, TRANSFER: 0.05 },
    PARTIALLY_CORRECT: { RECALL: 0.3, MECHANISM: 0.4, TRANSFER: 0.5 },
    CORRECT: { RECALL: 0.5, MECHANISM: 0.68, TRANSFER: 0.82 },
    TRANSFER_DEMONSTRATED: { RECALL: 0.55, MECHANISM: 0.72, TRANSFER: 0.85 },
  } as const;
  const evidence = turn.evidenceLevel;
  const target = targets[turn.assessment][evidence];
  return Math.round(Math.max(0, target - currentMastery) * 1000) / 1000;
}

export function nextScaffoldLevel(turn: TutorTurn, current: number, forceExplanation: boolean) {
  if (forceExplanation || turn.studentIntent === "REQUEST_HELP") return Math.min(4, current + 1);
  if (turn.assessment === "INCORRECT" || turn.studentIntent === "UNCERTAIN") return Math.min(4, current + 1);
  if (turn.assessment === "PARTIALLY_CORRECT") return current;
  return Math.max(0, current - 1);
}

export function demonstratesUnderstanding(turn: TutorTurn) {
  return (turn.assessment === "CORRECT" || turn.assessment === "TRANSFER_DEMONSTRATED")
    && (turn.evidenceLevel === "MECHANISM" || turn.evidenceLevel === "TRANSFER");
}
