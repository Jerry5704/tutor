import type { PrismaClient, QuestionFormat } from "../src/generated/prisma/client";

type SeedClient = Pick<PrismaClient, "questionItemVersion" | "questionObjective" | "questionRubric" | "rubricCriterion">;
type ObjectiveRef = { id: string; code: string };
type Criterion = { code: string; description: string; points: number };
type QuestionDefinition = {
  key: string;
  objectiveCode: string;
  prompt: string;
  format: QuestionFormat;
  difficulty: number;
  expectedMinutes: number;
  sourceLocator: string;
  criteria: Criterion[];
};

const q = (
  objectiveCode: string,
  key: string,
  prompt: string,
  sourceLocator: string,
  criteria: Criterion[],
  format: QuestionFormat = "OPEN_RESPONSE",
  difficulty = 3,
  expectedMinutes = 3,
): QuestionDefinition => ({ objectiveCode, key, prompt, sourceLocator, criteria, format, difficulty, expectedMinutes });

export const unit1MockExamQuestions: QuestionDefinition[] = [
  q("mol_nucleotide_structure", "missing-phosphate", "W schemacie krótkiego łańcucha DNA między cukrami dwóch sąsiednich nukleotydów brakuje reszty fosforanowej. Wyjaśnij, jaki element budowy nici nie może wtedy powstać i jaki jest skutek dla ciągłości łańcucha.", "book-pages:6-7", [
    { code: "identifies_backbone_link", description: "Wskazuje, że cukier i reszta fosforanowa są elementami szkieletu nici.", points: 1 },
    { code: "identifies_phosphodiester_bond", description: "Wskazuje brak możliwości utworzenia wiązania 3′,5′-fosfodiestrowego między nukleotydami.", points: 1 },
    { code: "predicts_broken_chain", description: "Wyjaśnia, że bez tego połączenia nie powstanie ciągły łańcuch polinukleotydowy.", points: 1 },
  ], "DIAGRAM"),
  q("mol_nucleotide_structure", "strand-polarity", "Koniec fragmentu DNA ma wolną resztę fosforanową przy atomie węgla 5′ cukru, a drugi koniec ma wolną grupę przy atomie węgla 3′. Nazwij oba końce i wyjaśnij, co oznacza polarność nici DNA.", "book-pages:6-7", [
    { code: "names_ends", description: "Poprawnie rozpoznaje koniec 5′ i koniec 3′.", points: 1 },
    { code: "explains_polarity", description: "Wyjaśnia, że nić ma dwa chemicznie różne końce i określony kierunek 5′→3′.", points: 1 },
  ]),

  q("mol_dna_structure_complementarity", "complementary-sequence", "Dla nici DNA 5′-AGC TTA CG-3′ zapisz nić komplementarną wraz z kierunkami. Następnie wyjaśnij, z czego wynikają wskazana kolejność zasad i przeciwny kierunek nici.", "book-pages:8-9", [
    { code: "correct_sequence", description: "Zapisuje sekwencję 3′-TCG AAT GC-5′ albo równoważny poprawny zapis odwrócony.", points: 1 },
    { code: "uses_pairing", description: "Uzasadnia sekwencję komplementarnym parowaniem A–T i G–C.", points: 1 },
    { code: "explains_antiparallel", description: "Wyjaśnia, że dwie nici DNA są antyrównoległe.", points: 1 },
  ], "SHORT_ANSWER"),
  q("mol_dna_structure_complementarity", "melting-comparison", "Fragment X i fragment Y mają po 100 par zasad. X zawiera 20 par G–C, a Y 65 par G–C. Wskaż fragment o wyższej temperaturze rozdzielenia nici i wyjaśnij pełny mechanizm, odnosząc się do liczby wiązań i energii cieplnej.", "book-pages:8-9,61", [
    { code: "selects_y", description: "Wskazuje fragment Y.", points: 1 },
    { code: "compares_bonds", description: "Wyjaśnia, że para G–C tworzy trzy, a A–T dwa wiązania wodorowe, więc Y ma ich łącznie więcej.", points: 1 },
    { code: "links_energy_temperature", description: "Łączy większą liczbę wiązań do zerwania z potrzebą dostarczenia większej energii cieplnej i wyższą temperaturą.", points: 1 },
  ], "TABLE_OR_GRAPH"),

  q("mol_dna_rna_comparison", "identify-rna", "Badana cząsteczka jest zwykle jednoniciowa, zawiera rybozę i uracyl. Określ, do której grupy kwasów nukleinowych należy. Wyjaśnij też, dlaczego na podstawie tych danych nie można rozstrzygnąć, czy jest to mRNA, tRNA czy rRNA.", "book-pages:13-15", [
    { code: "identifies_rna", description: "Rozpoznaje RNA na podstawie rybozy i uracylu.", points: 1 },
    { code: "states_inference_limit", description: "Wyjaśnia, że wspólne składniki nie określają konkretnej funkcji ani rodzaju RNA.", points: 1 },
  ]),
  q("mol_dna_rna_comparison", "rna-cooperation", "W komórce prawidłowo powstaje mRNA, ale do rybosomu nie docierają tRNA połączone z aminokwasami. Wyjaśnij, które etapy wykorzystania informacji genetycznej nadal mogą zajść, a który proces zostanie bezpośrednio zahamowany i dlaczego.", "book-pages:13-15,40-43", [
    { code: "recognizes_mrna_role", description: "Wskazuje, że mRNA może przenieść informację i związać się z rybosomem.", points: 1 },
    { code: "recognizes_trna_role", description: "Wyjaśnia, że bez tRNA nie będą dostarczane aminokwasy zgodne z kodonami.", points: 1 },
    { code: "predicts_translation_stop", description: "Wnioskuje, że synteza polipeptydu zostanie zahamowana.", points: 1 },
  ]),

  q("mol_replication_mechanism", "isotope-generation", "Po replikacji każda z dwóch cząsteczek DNA zawiera jedną nić pochodzącą z cząsteczki rodzicielskiej i jedną nić nową. Wyjaśnij ten wynik, opisując rolę obu rozdzielonych nici rodzicielskich.", "book-pages:16-17", [
    { code: "old_strands_separate", description: "Wskazuje rozdzielenie dwóch nici rodzicielskich.", points: 1 },
    { code: "each_is_template", description: "Wyjaśnia, że każda nić rodzicielska służy jako matryca syntezy nowej nici komplementarnej.", points: 1 },
    { code: "semiconservative_result", description: "Łączy ten mechanizm z obecnością jednej starej i jednej nowej nici w każdej cząsteczce potomnej.", points: 1 },
  ]),
  q("mol_replication_mechanism", "replication-before-division", "Komórka weszła w podział bez wcześniejszego podwojenia DNA. Przewidź bezpośredni problem dotyczący informacji genetycznej komórek potomnych i wyjaśnij, dlaczego replikacja musi poprzedzać podział.", "book-pages:16-17", [
    { code: "predicts_insufficient_copies", description: "Wskazuje brak dwóch kompletnych kopii DNA potrzebnych dla komórek potomnych.", points: 1 },
    { code: "links_replication_to_inheritance", description: "Wyjaśnia, że replikacja umożliwia przekazanie każdej komórce potomnej pełnego zestawu informacji genetycznej.", points: 1 },
  ]),

  q("mol_replication_enzymes", "ligase-inhibition", "W komórce helikaza, prymaza i polimeraza DNA działają prawidłowo, ale ligaza DNA została zahamowana. Przewidź bezpośredni skutek dla nowej nici opóźnionej i uzasadnij go funkcją ligazy.", "book-pages:16-20", [
    { code: "fragments_still_form", description: "Wskazuje, że fragmenty Okazaki mogą nadal powstawać.", points: 1 },
    { code: "fragments_not_joined", description: "Przewiduje pozostanie niepołączonych fragmentów nowej nici.", points: 1 },
    { code: "links_ligase_function", description: "Uzasadnia skutek funkcją ligazy polegającą na łączeniu fragmentów DNA.", points: 1 },
  ]),
  q("mol_replication_enzymes", "primase-inhibition", "Helikaza rozdzieliła nici DNA, lecz prymaza nie działa. Wyjaśnij, dlaczego sama polimeraza DNA nie może rozpocząć syntezy nowych nici i wskaż brakujący element.", "book-pages:16-20", [
    { code: "names_primer", description: "Wskazuje brak startera RNA z wolnym końcem 3′.", points: 1 },
    { code: "polymerase_limitation", description: "Wyjaśnia, że polimeraza DNA dołącza nukleotydy do istniejącego końca 3′ i nie rozpoczyna nici od zera.", points: 1 },
    { code: "predicts_synthesis_failure", description: "Wnioskuje, że synteza nowych nici nie rozpocznie się prawidłowo.", points: 1 },
  ]),

  q("mol_leading_lagging_strands", "fork-moving-right", "Widełki replikacyjne przesuwają się w prawo. Jedna matryca biegnie od lewej do prawej 3′→5′. Określ kierunek wzrostu nowej nici na tej matrycy, nazwij ją i wyjaśnij, dlaczego może powstawać ciągle.", "book-pages:17-20", [
    { code: "new_strand_direction", description: "Wskazuje syntezę nowej nici 5′→3′ w prawo.", points: 1 },
    { code: "names_leading", description: "Rozpoznaje nić wiodącą.", points: 1 },
    { code: "explains_continuity", description: "Wyjaśnia, że polimeraza może syntetyzować ją w tym samym kierunku co ruch widełek.", points: 1 },
  ], "DIAGRAM"),
  q("mol_leading_lagging_strands", "reverse-fork", "Widełki przesuwają się w lewo. Patrząc w kierunku ich ruchu, analizowana matryca biegnie 5′→3′. Określ, czy powstająca na niej nić jest wiodąca czy opóźniona, oraz wyjaśnij powstawanie starterów i fragmentów Okazaki.", "book-pages:17-20", [
    { code: "names_lagging", description: "Rozpoznaje nić opóźnioną.", points: 1 },
    { code: "uses_direction_rule", description: "Odwołuje się do syntezy nowej nici wyłącznie 5′→3′, przeciwnej w tym przypadku do ruchu widełek.", points: 1 },
    { code: "explains_fragments", description: "Wyjaśnia konieczność wielokrotnego tworzenia starterów i fragmentów Okazaki.", points: 1 },
  ], "DIAGRAM"),

  q("mol_gene_structure", "promoter-mutation", "Mutacja w promotorze genu nie zmieniła sekwencji kodującej białko, ale znacznie zmniejszyła ilość tego białka w komórce. Wyjaśnij mechanizm od promotora do ilości produktu.", "book-pages:27-28", [
    { code: "promoter_regulates_transcription", description: "Wskazuje wpływ promotora na przyłączenie aparatu transkrypcyjnego lub rozpoczęcie transkrypcji.", points: 1 },
    { code: "less_mrna", description: "Przewiduje powstawanie mniejszej ilości mRNA.", points: 1 },
    { code: "less_protein", description: "Łączy mniejszą ilość mRNA z mniejszą syntezą białka mimo niezmienionej jego sekwencji.", points: 1 },
  ]),
  q("mol_gene_structure", "gene-vs-mrna-length", "Dojrzałe mRNA ma 1200 nukleotydów, a transkrybowany odcinek genu był znacznie dłuższy. Podaj biologiczną przyczynę tej różnicy i wskaż los intronów oraz eksonów.", "book-pages:27-28,38-39", [
    { code: "identifies_discontinuous_gene", description: "Rozpoznaje obecność intronów i eksonów w genie nieciągłym lub pre-mRNA.", points: 1 },
    { code: "introns_removed", description: "Wskazuje usunięcie intronów podczas splicingu.", points: 1 },
    { code: "exons_joined", description: "Wskazuje połączenie eksonów w dojrzałym mRNA.", points: 1 },
  ]),

  q("mol_genome_organization", "bacterial-dna", "W komórce znaleziono jedną główną kolistą cząsteczkę DNA oraz kilka małych kolistych cząsteczek DNA replikujących się niezależnie. Zidentyfikuj oba rodzaje elementów i wyjaśnij, co łącznie oznacza pojęcie genomu tej komórki.", "book-pages:29-34", [
    { code: "identifies_bacterial_chromosome", description: "Rozpoznaje główny chromosom bakteryjny.", points: 1 },
    { code: "identifies_plasmids", description: "Rozpoznaje małe cząsteczki jako plazmidy.", points: 1 },
    { code: "defines_genome", description: "Wyjaśnia genom jako całość informacji genetycznej komórki, a nie pojedynczy gen.", points: 1 },
  ]),
  q("mol_genome_organization", "gene-chromosome-genome", "Uporządkuj pojęcia gen, chromosom i genom od elementu o najmniejszym zakresie do największego. Następnie wyjaśnij relację między każdym sąsiednim poziomem.", "book-pages:27-34", [
    { code: "correct_order", description: "Podaje kolejność: gen → chromosom → genom.", points: 1 },
    { code: "gene_in_chromosome", description: "Wyjaśnia, że gen jest funkcjonalnym odcinkiem DNA, a chromosom zawiera wiele genów.", points: 1 },
    { code: "chromosomes_in_genome", description: "Wyjaśnia, że genom obejmuje cały zestaw materiału genetycznego, w tym chromosomy.", points: 1 },
  ]),

  q("mol_genetic_code", "degenerate-not-ambiguous", "Kodony UCU i UCC oznaczają serynę, a każdy z nich w tabeli kodu wskazuje tylko ten jeden aminokwas. Nazwij dwie ilustrowane cechy kodu genetycznego i wyjaśnij, dlaczego nie są ze sobą sprzeczne.", "book-pages:35-36", [
    { code: "identifies_degeneracy", description: "Rozpoznaje zdegenerowanie: jeden aminokwas może być kodowany przez różne kodony.", points: 1 },
    { code: "identifies_unambiguity", description: "Rozpoznaje jednoznaczność: dany kodon oznacza tylko jeden aminokwas.", points: 1 },
    { code: "distinguishes_directions", description: "Wyjaśnia, że cechy opisują dwie przeciwne relacje: aminokwas→kodony i kodon→aminokwas.", points: 1 },
  ]),
  q("mol_genetic_code", "reading-frame-shift", "W sekwencji mRNA usunięto jeden nukleotyd blisko początku odczytywanego fragmentu. Wyjaśnij, jak ta zmiana może wpłynąć na grupowanie kolejnych nukleotydów w kodony i sekwencję aminokwasów.", "book-pages:35-36,44-45", [
    { code: "codons_are_triplets", description: "Odwołuje się do odczytywania mRNA kolejnymi trójkami nukleotydów.", points: 1 },
    { code: "predicts_frame_shift", description: "Wyjaśnia przesunięcie ramki odczytu od miejsca delecji.", points: 1 },
    { code: "predicts_changed_product", description: "Przewiduje zmianę wielu dalszych kodonów i zwykle sekwencji aminokwasów lub pojawienie się STOP.", points: 1 },
  ]),

  q("mol_transcription", "sequence-from-template", "Nić matrycowa DNA ma sekwencję 3′-TAC GGT CAA-5′. Zapisz powstający fragment mRNA wraz z kierunkiem i wyjaśnij regułę zastosowaną do jego utworzenia.", "book-pages:37-39,45-46", [
    { code: "correct_mrna", description: "Zapisuje 5′-AUG CCA GUU-3′.", points: 1 },
    { code: "uses_complementarity", description: "Stosuje komplementarność zasad, w tym U naprzeciw A w DNA.", points: 1 },
    { code: "uses_direction", description: "Wyjaśnia odczyt matrycy 3′→5′ i syntezę RNA 5′→3′.", points: 1 },
  ], "SHORT_ANSWER"),
  q("mol_transcription", "coding-strand-mutation", "W nici kodującej DNA triplet 5′-TGG-3′ zmienił się na 5′-TAG-3′. Zapisz odpowiadające im kodony mRNA i wyjaśnij, jak ta zmiana może wpłynąć na translację.", "book-pages:37-39,45-46", [
    { code: "derives_mrna_codons", description: "Wyznacza zmianę kodonu mRNA z 5′-UGG-3′ na 5′-UAG-3′.", points: 1 },
    { code: "recognizes_stop", description: "Rozpoznaje UAG jako kodon STOP.", points: 1 },
    { code: "predicts_shorter_product", description: "Przewiduje przedwczesne zakończenie translacji i skrócenie polipeptydu.", points: 1 },
  ]),

  q("mol_rna_processing", "retained-intron", "Mutacja zniszczyła miejsce wycinania intronu, dlatego intron pozostał w dojrzałym mRNA. Wyjaśnij dwa kolejne możliwe skutki: dla sekwencji odczytywanej przez rybosom i dla produktu białkowego.", "book-pages:38-39,47", [
    { code: "changes_mrna_sequence", description: "Wskazuje obecność dodatkowej sekwencji intronu w mRNA.", points: 1 },
    { code: "changes_translation", description: "Wyjaśnia możliwość zmiany kodonów, ramki odczytu lub pojawienia się kodonu STOP.", points: 1 },
    { code: "changes_protein", description: "Przewiduje zmianę długości, sekwencji lub funkcji białka.", points: 1 },
  ]),
  q("mol_rna_processing", "alternative-splicing", "W dwóch typach komórek ten sam pierwotny transkrypt jest składany tak, że dojrzałe mRNA zawierają różne zestawy eksonów. Wyjaśnij, jak może to prowadzić do powstania różnych białek bez zmiany sekwencji DNA genu.", "book-pages:38-39,56", [
    { code: "different_exon_combinations", description: "Wskazuje powstanie różnych dojrzałych mRNA wskutek połączenia różnych zestawów eksonów.", points: 1 },
    { code: "different_codons", description: "Łączy różne sekwencje mRNA z innymi sekwencjami kodonów.", points: 1 },
    { code: "different_proteins", description: "Wnioskuje o możliwości powstania polipeptydów o różnej sekwencji lub budowie.", points: 1 },
  ]),

  q("mol_translation", "codon-anticodon", "Dla kodonu mRNA 5′-GCU-3′ zapisz komplementarny antykodon tRNA wraz z kierunkiem. Następnie wyjaśnij rolę tRNA i rybosomu w dołączeniu właściwego aminokwasu.", "book-pages:40-44", [
    { code: "correct_anticodon", description: "Zapisuje antykodon 3′-CGA-5′ albo równoważny poprawny zapis odwrócony.", points: 1 },
    { code: "trna_role", description: "Wyjaśnia, że tRNA rozpoznaje kodon antykodonem i dostarcza przypisany aminokwas.", points: 1 },
    { code: "ribosome_role", description: "Wyjaśnia rolę rybosomu w odczycie mRNA i tworzeniu wiązań peptydowych.", points: 1 },
  ]),
  q("mol_translation", "premature-stop", "W kodującej części mRNA mutacja zamieniła kodon aminokwasu na kodon STOP. Przewidź wpływ na przebieg translacji, długość polipeptydu i prawdopodobną funkcję białka.", "book-pages:40-45", [
    { code: "translation_terminates", description: "Wskazuje przedwczesne zakończenie translacji na kodonie STOP.", points: 1 },
    { code: "shorter_polypeptide", description: "Przewiduje powstanie krótszego polipeptydu.", points: 1 },
    { code: "function_may_change", description: "Wyjaśnia, że brak części sekwencji może zaburzyć strukturę i funkcję białka.", points: 1 },
  ]),

  q("mol_prokaryotic_regulation", "lac-no-repressor-binding", "Mutacja sprawiła, że represor operonu laktozowego nie może wiązać operatora. Przewidź transkrypcję genów struktury przy braku laktozy i wyjaśnij mechanizm na poziomie operatora i polimerazy RNA.", "book-pages:50-53", [
    { code: "predicts_constitutive_expression", description: "Przewiduje transkrypcję mimo braku laktozy, z zastrzeżeniem wpływu regulacji dodatniej na intensywność.", points: 1 },
    { code: "operator_not_blocked", description: "Wyjaśnia, że niezwiązany operator nie jest blokowany przez represor.", points: 1 },
    { code: "polymerase_can_transcribe", description: "Łączy dostępność regionu regulatorowego z możliwością transkrypcji genów struktury przez polimerazę RNA.", points: 1 },
  ]),
  q("mol_prokaryotic_regulation", "trp-environment", "W środowisku bakterii gwałtownie spadło stężenie tryptofanu. Wyjaśnij zmianę aktywności represora operonu tryptofanowego oraz wynikający z niej wpływ na syntezę enzymów potrzebnych do wytwarzania tryptofanu.", "book-pages:50-51", [
    { code: "repressor_inactive", description: "Wskazuje, że bez tryptofanu-korepresora represor pozostaje nieaktywny i nie wiąże operatora.", points: 1 },
    { code: "transcription_on", description: "Wnioskuje o rozpoczęciu lub nasileniu transkrypcji genów struktury.", points: 1 },
    { code: "enzymes_produced", description: "Łączy ekspresję genów z produkcją enzymów syntezy tryptofanu.", points: 1 },
  ]),

  q("mol_eukaryotic_regulation", "condensed-chromatin", "Gen znajduje się w silnie skondensowanym fragmencie chromatyny. Wyjaśnij kolejno wpływ tej kondensacji na dostęp aparatu transkrypcyjnego, ilość mRNA i ilość białka.", "book-pages:54-55", [
    { code: "reduced_dna_access", description: "Wskazuje ograniczony dostęp białek transkrypcyjnych i polimerazy RNA do DNA.", points: 1 },
    { code: "less_transcription", description: "Przewiduje zmniejszenie lub zahamowanie transkrypcji i mniej mRNA.", points: 1 },
    { code: "less_protein", description: "Łączy mniejszą ilość mRNA z mniejszą ilością powstającego białka.", points: 1 },
  ]),
  q("mol_eukaryotic_regulation", "post-transcription-control", "W komórkach A i B dany gen jest transkrybowany z podobną intensywnością i powstaje podobna ilość mRNA, ale w komórce B białka jest znacznie mniej. Podaj dwa różne mechanizmy regulacji po transkrypcji, które mogą to wyjaśnić.", "book-pages:54-57", [
    { code: "first_post_transcription_mechanism", description: "Podaje poprawny mechanizm po transkrypcji, np. szybszą degradację mRNA, zahamowanie translacji albo szybszy rozkład białka.", points: 1 },
    { code: "second_distinct_mechanism", description: "Podaje drugi, odmienny poprawny mechanizm regulacji po transkrypcji.", points: 1 },
    { code: "links_to_lower_protein", description: "Wyjaśnia, jak przynajmniej jeden z mechanizmów zmniejsza ilość białka.", points: 1 },
  ]),

  q("mol_cell_differentiation", "same-genome-different-cells", "Neuron i komórka mięśniowa tego samego człowieka mają zasadniczo ten sam genom, ale różnią się budową i działaniem. Wyjaśnij łańcuch przyczynowy od aktywności genów do specjalizacji tych komórek.", "book-pages:49,54-55,58", [
    { code: "different_active_genes", description: "Wskazuje aktywność różnych zestawów genów w obu typach komórek.", points: 1 },
    { code: "different_proteins", description: "Łączy różną ekspresję genów z wytwarzaniem różnych zestawów białek.", points: 1 },
    { code: "proteins_determine_specialization", description: "Wyjaśnia, że różne białka warunkują odmienną budowę i funkcję komórek.", points: 1 },
  ]),
  q("mol_cell_differentiation", "liver-specific-protein", "Gen występuje zarówno w komórkach wątroby, jak i skóry, ale kodowane przez niego białko wykryto tylko w wątrobie. Wyjaśnij wynik bez odwoływania się do utraty genu przez komórki skóry.", "book-pages:54-55,58", [
    { code: "gene_present_both", description: "Przyjmuje obecność genu w obu typach komórek.", points: 1 },
    { code: "different_expression", description: "Wskazuje aktywność genu w wątrobie i jego wyciszenie lub brak ekspresji w skórze.", points: 1 },
    { code: "links_expression_to_protein", description: "Łączy różną ekspresję z obecnością białka tylko w wątrobie.", points: 1 },
  ]),
].map((definition) => ({ ...definition, key: `unit-1:${definition.objectiveCode}:mock:${definition.key}` }));

export async function syncUnit1MockExamBank(db: SeedClient, objective: ObjectiveRef) {
  const definitions = unit1MockExamQuestions.filter((definition) => definition.objectiveCode === objective.code);
  if (definitions.length !== 2) throw new Error(`Expected exactly two mock questions for ${objective.code}, found ${definitions.length}`);
  for (const definition of definitions) {
    const question = await db.questionItemVersion.upsert({
      where: { stableKey_version: { stableKey: definition.key, version: 1 } },
      update: {
        prompt: definition.prompt, purpose: "MOCK_EXAM", format: definition.format, evidenceLevel: "TRANSFER",
        difficulty: definition.difficulty, status: "APPROVED", sourceType: "CURRICULUM_DERIVED",
        sourceLocator: definition.sourceLocator, sourceVersion: "unit-1-textbook-mock-v1", expectedMinutes: definition.expectedMinutes,
      },
      create: {
        stableKey: definition.key, version: 1, prompt: definition.prompt, purpose: "MOCK_EXAM", format: definition.format,
        evidenceLevel: "TRANSFER", difficulty: definition.difficulty, status: "APPROVED", sourceType: "CURRICULUM_DERIVED",
        sourceLocator: definition.sourceLocator, sourceVersion: "unit-1-textbook-mock-v1", expectedMinutes: definition.expectedMinutes,
      },
    });
    await db.questionObjective.upsert({
      where: { questionVersionId_learningObjectiveId: { questionVersionId: question.id, learningObjectiveId: objective.id } },
      update: { importance: 1 }, create: { questionVersionId: question.id, learningObjectiveId: objective.id, importance: 1 },
    });
    const maxPoints = definition.criteria.reduce((sum, criterion) => sum + criterion.points, 0);
    const rubric = await db.questionRubric.upsert({
      where: { stableKey_version: { stableKey: `${definition.key}:rubric`, version: 1 } },
      update: {
        questionVersionId: question.id, title: "Schemat punktowania — genetyka molekularna", sourceType: "CURRICULUM_DERIVED",
        scoringMode: "EXAM_POINTS", status: "APPROVED", sourceLocator: definition.sourceLocator,
        sourceVersion: "unit-1-textbook-mock-v1", maxPoints,
      },
      create: {
        stableKey: `${definition.key}:rubric`, version: 1, questionVersionId: question.id,
        title: "Schemat punktowania — genetyka molekularna", sourceType: "CURRICULUM_DERIVED", scoringMode: "EXAM_POINTS",
        status: "APPROVED", sourceLocator: definition.sourceLocator, sourceVersion: "unit-1-textbook-mock-v1", maxPoints,
      },
    });
    for (const criterion of definition.criteria) {
      await db.rubricCriterion.upsert({
        where: { questionRubricId_code: { questionRubricId: rubric.id, code: criterion.code } },
        update: { description: criterion.description, required: true, points: criterion.points, evidenceLevel: "TRANSFER" },
        create: { questionRubricId: rubric.id, code: criterion.code, description: criterion.description, required: true, points: criterion.points, evidenceLevel: "TRANSFER" },
      });
    }
  }
}
