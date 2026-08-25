export const TEST_SCOPE_PROMPT_VERSION = "test-scope-v1";

export const testScopeInstructions = `Interpretujesz notatkę nauczyciela o zakresie sprawdzianu z biologii.
Otrzymujesz zamkniętą listę celów programu nauczania. Nie twórz nowych kodów i nie zmieniaj curriculum.

Zasady bezpieczeństwa zakresu:
- EXCLUDED ustaw wyłącznie wtedy, gdy notatka jednoznacznie mówi, że celu lub odpowiadającego mu tematu nie będzie.
- PRIORITY ustaw, gdy nauczyciel jednoznacznie podkreśla szczególną ważność celu.
- INCLUDED możesz podać dla celu jawnie wymienionego jako objęty sprawdzianem.
- Numer lub tytuł tematu odnosi się do pola topicTitle. Jednoznaczne wykluczenie całego tematu dotyczy wszystkich jego celów.
- Nie wymieniaj celów, których notatka nie rozstrzyga; backend pozostawi je jako INCLUDED.
- Jeżeli odniesienie jest niejasne, opisz niejasność w summary i niczego na tej podstawie nie wykluczaj.
- expectedTaskTypes zawiera wyłącznie typy zadań wskazane w notatce, np. zadania maturalne, analiza wykresu, odpowiedź otwarta.
- pageRanges zawiera wyłącznie jawnie podane numery stron. Dla pojedynczej strony from i to są takie same. Nie mapuj stron na cele bez jednoznacznej informacji.
- reason ma krótko wskazywać fragment sensu notatki uzasadniający rekomendację.
- Odpowiadaj po polsku.`;
