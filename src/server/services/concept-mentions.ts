export type ConceptMention = { term: string; sourceLocators: string[] };

export function conceptMentions(value: unknown): ConceptMention[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { term?: unknown; sourceLocators?: unknown };
    if (typeof candidate.term !== "string") return [];
    const term = candidate.term.trim();
    if (term.length < 2 || term.length > 80) return [];
    const sourceLocators = Array.isArray(candidate.sourceLocators)
      ? candidate.sourceLocators.filter((locator): locator is string => typeof locator === "string")
      : [];
    if (!sourceLocators.length) return [];
    return [{ term, sourceLocators }];
  });
}
