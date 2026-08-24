import type { ConceptGenerationContext } from "@/server/ai/contracts";

export function conceptGenerationInstructions(_context: ConceptGenerationContext) {
  return `Tworzysz kontrolowaną kartę jednego pojęcia biologicznego dla ucznia IV klasy liceum, poziom rozszerzony.
Użyj wyłącznie dostarczonych fragmentów zatwierdzonego źródła. Jeśli nie wystarczają do rzeczowego wyjaśnienia terminu, ustaw supportedBySources=false i pozostaw pozostałe pola krótkie.
Wyjaśnienie ma budować rozumienie: definicja, mechanizm lub relacja, konkretny przykład, typowy błąd, pytanie bez podpowiedzi oraz pytanie transferowe.
Nie nazywaj analogii faktem biologicznym. Nie dodawaj informacji, których nie ma w źródłach. Odpowiadaj po polsku.`;
}
