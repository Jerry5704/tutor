export type AnnotatableConcept = {
  id: string;
  slug: string;
  name: string;
  aliases: Array<{ alias: string }>;
  studentStates: Array<{ mastery: number; confidence: number; evidenceCount: number; selfFamiliarity: string }>;
};

export type ConceptTone = "unknown" | "needs-work" | "developing" | "mastered";
export type AnnotatedSegment = { text: string; concept?: { slug: string; name: string; tone: ConceptTone; selfFamiliarity: string } };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function conceptTone(concept: AnnotatableConcept): ConceptTone {
  const state = concept.studentStates[0];
  if (!state || state.evidenceCount === 0) return "unknown";
  if (state.mastery >= 0.75 && state.confidence >= 0.5) return "mastered";
  if (state.mastery < 0.3 && state.confidence >= 0.35) return "needs-work";
  return "developing";
}

export function annotateConceptText(text: string, concepts: AnnotatableConcept[], maxMatches = Number.POSITIVE_INFINITY): AnnotatedSegment[] {
  const matches: Array<{ start: number; end: number; concept: AnnotatableConcept }> = [];
  for (const concept of concepts) {
    const aliases = [concept.name, ...concept.aliases.map((item) => item.alias)].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, "giu");
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        matches.push({ start: match.index, end: match.index + match[0].length, concept });
      }
    }
  }
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const selected: typeof matches = [];
  for (const match of matches) {
    if (selected.some((item) => match.start < item.end && match.end > item.start)) continue;
    selected.push(match);
    if (selected.length >= maxMatches) break;
  }
  selected.sort((a, b) => a.start - b.start);

  const segments: AnnotatedSegment[] = [];
  let cursor = 0;
  for (const match of selected) {
    if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start) });
    const state = match.concept.studentStates[0];
    segments.push({
      text: text.slice(match.start, match.end),
      concept: {
        slug: match.concept.slug,
        name: match.concept.name,
        tone: conceptTone(match.concept),
        selfFamiliarity: state?.selfFamiliarity ?? "UNKNOWN",
      },
    });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length ? segments : [{ text }];
}
