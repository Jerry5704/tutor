UPDATE "LearningObjective"
SET
  "diagnosticPrompt" = 'Wyjaśnij cechy kodu genetycznego: trójkowy, jednoznaczny, zdegenerowany, bezprzecinkowy, niezachodzący i uniwersalny. Jeśli nie pamiętasz wszystkich, wyjaśnij te, które znasz.',
  "microExplanation" = 'Kodon to trójka nukleotydów mRNA. Kodony są odczytywane kolejno, bez przerw i bez nakładania się. Jeden kodon ma jedno znaczenie, jeden aminokwas może mieć kilka kodonów, a reguły kodu są niemal uniwersalne.'
WHERE "code" = 'mol_genetic_code';
