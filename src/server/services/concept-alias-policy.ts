export function isGenotypeSymbol(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 2
    && /^[A-Za-z]{2}$/u.test(trimmed)
    && trimmed[0]?.toLocaleLowerCase("pl-PL") === trimmed[1]?.toLocaleLowerCase("pl-PL");
}

export function normalizedConceptAlias(value: string) {
  const trimmed = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  return isGenotypeSymbol(trimmed) ? `genotype:${trimmed}` : trimmed.toLocaleLowerCase("pl-PL");
}

export function conceptAliasAppearsInText(text: string, alias: string) {
  if (isGenotypeSymbol(alias)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
  }
  return text.toLocaleLowerCase("pl-PL").normalize("NFKC").replace(/\s+/gu, " ")
    .includes(alias.toLocaleLowerCase("pl-PL").normalize("NFKC").replace(/\s+/gu, " ").trim());
}
