import type { ConceptGenerationContext } from "@/server/ai/contracts";

export const CONCEPT_GENERATION_PROMPT_VERSION = "concept-generation-v1";

export function conceptGenerationInstructions(_context: ConceptGenerationContext) {
  return `Tworzysz kontrolowaną kartę jednego pojęcia biologicznego dla ucznia IV klasy liceum, poziom rozszerzony.
Użyj wyłącznie dostarczonych fragmentów zatwierdzonego źródła. Jeśli nie wystarczają do rzeczowego wyjaśnienia terminu, ustaw supportedBySources=false i pozostaw pozostałe pola krótkie.
Wyjaśnienie ma budować rozumienie: definicja, mechanizm lub relacja, konkretny przykład, typowy błąd, pytanie bez podpowiedzi oraz pytanie transferowe.
canonicalName podaj w podstawowej, słownikowej formie. aliases mają zawierać naturalne polskie odmiany całego terminu,
które mogą wystąpić w zdaniu: liczbę pojedynczą i mnogą oraz typowe przypadki. Nie twórz odmian przez mechaniczne
obcinanie końcówek i nie dodawaj form niegramatycznych. Zachowaj znaczenie dokładnie tego samego pojęcia.
Nie nazywaj analogii faktem biologicznym. Nie dodawaj informacji, których nie ma w źródłach. Odpowiadaj po polsku.`;
}
