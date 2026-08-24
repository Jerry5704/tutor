export const objectiveCodes = [
  "mol_nucleotide_structure",
  "mol_dna_structure_complementarity",
  "mol_dna_rna_comparison",
  "mol_replication_mechanism",
  "mol_replication_enzymes",
  "mol_leading_lagging_strands",
  "mol_gene_structure",
  "mol_genome_organization",
  "mol_genetic_code",
  "mol_transcription",
  "mol_rna_processing",
  "mol_translation",
  "mol_prokaryotic_regulation",
  "mol_eukaryotic_regulation",
  "mol_cell_differentiation",
] as const;

export type ObjectiveCode = typeof objectiveCodes[number];
export type KnowledgeLevel = "UNKNOWN" | "MISCONCEPTION" | "PARTIAL" | "MASTERED";

export type SyntheticPersona = {
  id: string;
  name: string;
  style: string;
  defaultLevel: KnowledgeLevel;
  levels: Partial<Record<ObjectiveCode, KnowledgeLevel>>;
  plannedConceptQuestions: Partial<Record<ObjectiveCode, string>>;
};

export const partialAnswers: Record<ObjectiveCode, string> = {
  mol_nucleotide_structure: "Nukleotyd buduje DNA i ma cukier, fosforan oraz zasadę azotową, ale nie pamiętam dokładnie, jak tworzy się z nich nić.",
  mol_dna_structure_complementarity: "A łączy się z T, a G z C. Wiem też, że nici biegną przeciwnie, ale mylą mi się oznaczenia 3′ i 5′.",
  mol_dna_rna_comparison: "DNA ma deoksyrybozę i tyminę, a RNA rybozę i uracyl. RNA jest zwykle jednoniciowe, ale słabo pamiętam funkcje jego rodzajów.",
  mol_replication_mechanism: "Przed podziałem DNA jest kopiowane. Chyba każda stara nić pomaga utworzyć nową, ale nie umiem tego dokładnie uzasadnić.",
  mol_replication_enzymes: "Helikaza rozdziela nici, a polimeraza dobudowuje DNA. Nie pamiętam roli prymazy i ligazy.",
  mol_leading_lagging_strands: "Jedna nić powstaje ciągle, a druga kawałkami, ale nie potrafię połączyć tego z kierunkiem 5′→3′.",
  mol_gene_structure: "Eksony zostają w mRNA, a introny są wycinane. Nie pamiętam dokładnie roli części regulatorowej.",
  mol_genome_organization: "Gen to fragment DNA, chromosom zawiera DNA, a genom to chyba cały zestaw materiału genetycznego.",
  mol_genetic_code: "Kodon ma trzy nukleotydy i oznacza aminokwas. Nie umiem jeszcze wyjaśnić wszystkich cech kodu.",
  mol_transcription: "Podczas transkrypcji powstaje RNA na podstawie DNA, ale mylą mi się nić matrycowa i kodująca.",
  mol_rna_processing: "Z pre-mRNA usuwa się introny i łączy eksony. Nie rozumiem jeszcze alternatywnego składania.",
  mol_translation: "Rybosom czyta mRNA, a tRNA dostarcza aminokwasy. Nie umiem poprawnie zapisać antykodonu z kierunkami.",
  mol_prokaryotic_regulation: "W operonie są promotor, operator i geny, ale nie rozumiem dokładnie, jak represor włącza albo wyłącza transkrypcję.",
  mol_eukaryotic_regulation: "Komórka może regulować transkrypcję i translację, ale nie potrafię uporządkować wszystkich poziomów.",
  mol_cell_differentiation: "Komórki mają te same geny, lecz wykorzystują inne ich zestawy, dlatego wytwarzają inne białka.",
};

export const misconceptionAnswers: Partial<Record<ObjectiveCode, string>> = {
  mol_dna_structure_complementarity: "Wiązania wodorowe łączą chyba kolejne nukleotydy wzdłuż jednej nici, dlatego DNA się nie rozpada.",
  mol_replication_mechanism: "Semikonserwatywna oznacza, że kopiowana jest tylko połowa DNA, a druga połowa zostaje stara.",
  mol_replication_enzymes: "Polimeraza rozdziela nici, a helikaza dobudowuje nowe nukleotydy w dowolnym kierunku.",
  mol_leading_lagging_strands: "Nić opóźniona powstaje fragmentami, bo polimeraza na niej działa wolniej.",
  mol_gene_structure: "Introny kodują białko, dlatego muszą zostać w dojrzałym mRNA, a eksony są usuwane.",
  mol_genetic_code: "Zdegenerowany kod oznacza, że jeden kodon może oznaczać kilka różnych aminokwasów.",
  mol_transcription: "mRNA jest identyczne z nicią matrycową DNA, tylko zamiast tyminy ma uracyl.",
  mol_rna_processing: "Splicing polega na usuwaniu eksonów i pozostawianiu intronów w dojrzałym mRNA.",
  mol_translation: "tRNA odczytuje całe mRNA i samo łączy aminokwasy bez udziału rybosomu.",
  mol_prokaryotic_regulation: "Represor zawsze uruchamia transkrypcję, gdy zwiąże się z operatorem.",
  mol_cell_differentiation: "Neuron i komórka mięśniowa działają inaczej, bo w czasie różnicowania tracą niepotrzebne geny.",
};

export const personas: SyntheticPersona[] = [
  {
    id: "novice",
    name: "Początkujący od zera",
    style: "Piszesz naturalnie, czasem przyznajesz, że nie rozumiesz terminu. Po dobrym wyjaśnieniu próbujesz uczciwie odpowiedzieć własnymi słowami.",
    defaultLevel: "UNKNOWN",
    levels: { mol_nucleotide_structure: "PARTIAL" },
    plannedConceptQuestions: {
      mol_dna_structure_complementarity: "Czym dokładnie jest energia cieplna?",
      mol_replication_enzymes: "Czym jest starter podczas replikacji DNA?",
    },
  },
  {
    id: "definition_only",
    name: "Zna definicje, nie mechanizmy",
    style: "Kojarzysz nazwy i definicje, ale często nie potrafisz podać związku przyczynowego. Odpowiadasz w 1–3 zdaniach.",
    defaultLevel: "PARTIAL",
    levels: {
      mol_replication_mechanism: "MISCONCEPTION",
      mol_leading_lagging_strands: "MISCONCEPTION",
      mol_genetic_code: "MISCONCEPTION",
    },
    plannedConceptQuestions: {},
  },
  {
    id: "misconceptions",
    name: "Uczeń z błędnymi modelami",
    style: "Jesteś przekonany do swoich początkowych odpowiedzi, ale zmieniasz zdanie, gdy tutor jasno pokaże mechanizm i przykład.",
    defaultLevel: "PARTIAL",
    levels: {
      mol_dna_structure_complementarity: "MISCONCEPTION",
      mol_replication_mechanism: "MISCONCEPTION",
      mol_replication_enzymes: "MISCONCEPTION",
      mol_gene_structure: "MISCONCEPTION",
      mol_transcription: "MISCONCEPTION",
      mol_rna_processing: "MISCONCEPTION",
      mol_translation: "MISCONCEPTION",
      mol_prokaryotic_regulation: "MISCONCEPTION",
      mol_cell_differentiation: "MISCONCEPTION",
    },
    plannedConceptQuestions: { mol_dna_structure_complementarity: "Co to są wiązania wodorowe?" },
  },
  {
    id: "average",
    name: "Przeciętny, nierówny poziom",
    style: "Odpowiadasz jak zwykły uczeń: czasem precyzyjnie, czasem skrótowo. Jeśli czegoś nie wiesz, mówisz to wprost.",
    defaultLevel: "PARTIAL",
    levels: {
      mol_nucleotide_structure: "MASTERED",
      mol_dna_structure_complementarity: "MASTERED",
      mol_replication_enzymes: "UNKNOWN",
      mol_leading_lagging_strands: "UNKNOWN",
      mol_rna_processing: "UNKNOWN",
      mol_prokaryotic_regulation: "UNKNOWN",
      mol_eukaryotic_regulation: "UNKNOWN",
    },
    plannedConceptQuestions: {},
  },
  {
    id: "terse",
    name: "Lakoniczny i niecierpliwy",
    style: "Piszesz bardzo krótko i potocznie. Gdy nie rozumiesz, prosisz wprost o odpowiedź. Nie sabotujesz jednak nauki i po wyjaśnieniu próbujesz dalej.",
    defaultLevel: "PARTIAL",
    levels: {
      mol_replication_enzymes: "UNKNOWN",
      mol_leading_lagging_strands: "MISCONCEPTION",
      mol_transcription: "UNKNOWN",
      mol_prokaryotic_regulation: "UNKNOWN",
    },
    plannedConceptQuestions: { mol_replication_enzymes: "Ej, ale co to właściwie jest starter?" },
  },
  {
    id: "advanced",
    name: "Zaawansowany",
    style: "Odpowiadasz rzeczowo własnymi słowami, pokazujesz mechanizm i stosujesz wiedzę w nowych sytuacjach. Nie dodajesz niepotrzebnych dygresji.",
    defaultLevel: "MASTERED",
    levels: {
      mol_eukaryotic_regulation: "PARTIAL",
      mol_prokaryotic_regulation: "PARTIAL",
    },
    plannedConceptQuestions: {},
  },
];

export function levelFor(persona: SyntheticPersona, objectiveCode: string): KnowledgeLevel {
  return persona.levels[objectiveCode as ObjectiveCode] ?? persona.defaultLevel;
}
