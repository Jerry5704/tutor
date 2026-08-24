import { createHash } from "node:crypto";

export type QuestionIntent = "DIAGNOSTIC" | "PRACTICE" | "CORRECTION" | "TRANSFER" | "UNDERSTANDING_CHECK";

const genericWords = new Set([
  "aby", "ale", "bez", "czy", "dla", "dlaczego", "do", "i", "jak", "jest", "ktora", "ktore", "ktory",
  "ma", "maja", "na", "napisz", "odpowiedz", "oraz", "podaj", "porownaj", "sama", "same", "sam", "sie",
  "spróbuj", "sprobuj", "taka", "takie", "ten", "teraz", "to", "uzasadnij", "w", "we", "wlasnymi", "wyjasnij",
  "z", "za", "zdaniami",
]);

function normalizedTokens(question: string) {
  return [...new Set(question
    .toLocaleLowerCase("pl-PL")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[′’]/gu, "'")
    .match(/[a-z0-9']{2,}/gu) ?? [])]
    .filter((token) => !genericWords.has(token))
    .map((token) => token.length > 7 ? token.slice(0, 7) : token)
    .sort();
}

export function questionFingerprint(learningObjectiveId: string, question: string) {
  const focus = normalizedTokens(question).join("|");
  const digest = createHash("sha256").update(focus).digest("hex").slice(0, 16);
  return `${learningObjectiveId}:${digest}:${focus}`;
}

function focusTokens(fingerprint: string) {
  const focus = fingerprint.split(":", 3)[2] ?? "";
  return new Set(focus.split("|").filter(Boolean));
}

export function fingerprintsOverlap(candidate: string, previous: string) {
  if (candidate === previous) return true;
  const sameObjective = candidate.split(":", 1)[0] === previous.split(":", 1)[0];
  const left = focusTokens(candidate);
  const right = focusTokens(previous);
  if (!left.size || !right.size) return false;
  const shared = [...left].filter((token) => right.has(token)).length;
  const smallerCoverage = shared / Math.min(left.size, right.size);
  const union = new Set([...left, ...right]).size;
  const jaccard = shared / union;
  return (smallerCoverage >= 0.72 && jaccard >= 0.38)
    || (sameObjective && shared >= 6 && smallerCoverage >= 0.45 && jaccard >= 0.25);
}

export function intentForNextAction(nextAction: string): QuestionIntent | undefined {
  if (nextAction === "PROBE") return "DIAGNOSTIC";
  if (nextAction === "TRANSFER_QUESTION") return "TRANSFER";
  if (["GUIDED_QUESTION", "HINT", "EXPLAIN", "WORKED_EXAMPLE"].includes(nextAction)) return "CORRECTION";
  return "PRACTICE";
}
