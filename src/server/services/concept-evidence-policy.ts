export type EvidenceConcept = {
  id: string;
  name: string;
  aliases: string[];
};

function normalized(value: string) {
  return value.toLocaleLowerCase("pl-PL")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ł/gu, "l");
}

function mentions(text: string, aliases: string[]) {
  const haystack = normalized(text);
  return aliases.some((alias) => {
    const term = normalized(alias).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?<![a-z0-9])${term}(?![a-z0-9])`, "u").test(haystack);
  });
}

export function explicitlySupportedConceptIds(text: string, concepts: EvidenceConcept[]) {
  return concepts
    .filter((concept) => mentions(text, [concept.name, ...concept.aliases]))
    .map((concept) => concept.id);
}

export function conceptMasteryTarget(evidenceLevel: "RECALL" | "MECHANISM" | "TRANSFER") {
  if (evidenceLevel === "TRANSFER") return 0.72;
  if (evidenceLevel === "MECHANISM") return 0.6;
  return 0.35;
}

export function aggregateConceptMastery(params: {
  links: Array<{ conceptId: string; importance: number }>;
  masteryByConcept: Map<string, number>;
  currentObjectiveMastery: number;
}) {
  const totalWeight = params.links.reduce((sum, link) => sum + link.importance, 0);
  if (totalWeight <= 0) return params.currentObjectiveMastery;
  const aggregate = params.links.reduce(
    (sum, link) => sum + (params.masteryByConcept.get(link.conceptId) ?? 0) * link.importance,
    0,
  ) / totalWeight;
  return Math.max(params.currentObjectiveMastery, Math.round(aggregate * 1000) / 1000);
}
