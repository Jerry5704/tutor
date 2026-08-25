import { isGenotypeSymbol } from "@/server/services/concept-alias-policy";

const TERM_PATTERNS = [
  /\bco to jest\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
  /\bco (?:to )?(?:znaczy|oznacza)\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
  /\bczym jest\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
  /\b(?:wyjaśnij|wytłumacz)(?: mi)?\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
];

export function requestedConceptTerm(message: string) {
  for (const pattern of TERM_PATTERNS) {
    const term = pattern.exec(message)?.[1]?.replace(/[?.!]+$/gu, "").trim();
    if (term && term.length <= 80 && (term.length >= 3 || isGenotypeSymbol(term))) return term;
  }
}
