import type { PrismaClient } from "../src/generated/prisma/client";

type SeedClient = Pick<PrismaClient, "questionItemVersion" | "questionObjective" | "questionRubric" | "rubricCriterion">;

type ObjectiveRef = { id: string; code: string };

const questions = [
  {
    stableKey: "quick-classic:mock:heterozygote-phenotype",
    objectiveCode: "classic_genotype_phenotype_test",
    prompt: "U królików allel B warunkuje czarne umaszczenie i jest dominujący nad allelem b warunkującym białe umaszczenie. Osobnik ma genotyp Bb. Określ, czy jest homozygotą czy heterozygotą, podaj jego fenotyp i uzasadnij oba rozstrzygnięcia.",
    difficulty: 2,
    sourceLocator: "book-pages:66-67",
    criteria: [
      { code: "heterozygote", description: "Rozpoznaje genotyp Bb jako heterozygotę.", points: 1 },
      { code: "dominant_phenotype", description: "Wskazuje czarne, dominujące umaszczenie.", points: 1 },
      { code: "genotype_and_dominance_reasoning", description: "Uzasadnia heterozygotyczność obecnością dwóch różnych alleli oraz fenotyp dominacją allelu B.", points: 1 },
    ],
  },
  {
    stableKey: "quick-classic:mock:phenotype-limits",
    objectiveCode: "classic_genotype_phenotype_test",
    prompt: "Przy dominacji zupełnej roślina o czerwonych kwiatach może mieć genotyp RR albo Rr, a roślina rr ma kwiaty białe. Widzisz wyłącznie roślinę o czerwonych kwiatach. Podaj wszystkie możliwe genotypy tej rośliny i wyjaśnij, czego nie można ustalić na podstawie samego fenotypu.",
    difficulty: 3,
    sourceLocator: "book-pages:66-67",
    criteria: [
      { code: "both_dominant_genotypes", description: "Podaje oba możliwe genotypy RR i Rr.", points: 1 },
      { code: "excludes_recessive_genotype", description: "Nie uznaje rr za możliwy genotyp czerwonej rośliny przy podanych założeniach.", points: 1 },
      { code: "phenotype_inference_limit", description: "Wyjaśnia, że sam fenotyp dominujący nie rozstrzyga, czy osobnik jest homozygotą dominującą, czy heterozygotą.", points: 1 },
    ],
  },
  {
    stableKey: "quick-classic:mock:punnett-aa-cross",
    objectiveCode: "classic_mendel_punnett_test",
    prompt: "Wykonaj krzyżówkę Aa × aa przy dominacji zupełnej allelu A. Podaj rodzaje gamet obojga rodziców, prawdopodobieństwa genotypów potomstwa oraz prawdopodobieństwa fenotypu dominującego i recesywnego.",
    difficulty: 2,
    sourceLocator: "book-pages:69-72",
    criteria: [
      { code: "parent_gametes", description: "Podaje gamety A i a dla rodzica Aa oraz gamety a dla rodzica aa.", points: 1 },
      { code: "offspring_genotypes", description: "Wyznacza 50% Aa i 50% aa.", points: 1 },
      { code: "offspring_phenotypes", description: "Wyznacza 50% fenotypu dominującego i 50% recesywnego.", points: 1 },
      { code: "links_genotype_to_phenotype", description: "Poprawnie łączy Aa z fenotypem dominującym, a aa z recesywnym.", points: 1 },
    ],
  },
  {
    stableKey: "quick-classic:mock:rh-inference",
    objectiveCode: "classic_mendel_punnett_test",
    prompt: "Allel D warunkujący Rh+ jest dominujący nad allelem d. Dwoje rodziców Rh+ ma dziecko Rh−. Ustal genotypy rodziców i oblicz prawdopodobieństwo, że ich kolejne dziecko będzie Rh−. Pokaż tok rozumowania za pomocą gamet lub szachownicy Punnetta.",
    difficulty: 3,
    sourceLocator: "book-page:74",
    criteria: [
      { code: "infers_parent_genotypes", description: "Wnioskuje, że oboje rodzice mają genotyp Dd.", points: 1 },
      { code: "shows_gametes_or_cross", description: "Pokazuje gamety D i d obojga rodziców albo równoważną szachownicę krzyżówki Dd × Dd.", points: 1 },
      { code: "calculates_recessive_probability", description: "Wyznacza jedno dd na cztery możliwe połączenia, czyli 25% prawdopodobieństwa Rh−.", points: 1 },
    ],
  },
] as const;

export async function syncQuickMockExamBank(db: SeedClient, objectives: ObjectiveRef[]) {
  const byCode = new Map(objectives.map((objective) => [objective.code, objective]));
  for (const definition of questions) {
    const objective = byCode.get(definition.objectiveCode);
    if (!objective) throw new Error(`Missing objective ${definition.objectiveCode} for mock exam seed`);
    const question = await db.questionItemVersion.upsert({
      where: { stableKey_version: { stableKey: definition.stableKey, version: 1 } },
      update: {
        prompt: definition.prompt,
        purpose: "MOCK_EXAM",
        format: "OPEN_RESPONSE",
        evidenceLevel: "TRANSFER",
        difficulty: definition.difficulty,
        status: "APPROVED",
        sourceType: "CURRICULUM_DERIVED",
        sourceLocator: definition.sourceLocator,
        sourceVersion: "quick-classic-mock-v1",
        expectedMinutes: 4,
      },
      create: {
        stableKey: definition.stableKey,
        version: 1,
        prompt: definition.prompt,
        purpose: "MOCK_EXAM",
        format: "OPEN_RESPONSE",
        evidenceLevel: "TRANSFER",
        difficulty: definition.difficulty,
        status: "APPROVED",
        sourceType: "CURRICULUM_DERIVED",
        sourceLocator: definition.sourceLocator,
        sourceVersion: "quick-classic-mock-v1",
        expectedMinutes: 4,
      },
    });
    await db.questionObjective.upsert({
      where: { questionVersionId_learningObjectiveId: { questionVersionId: question.id, learningObjectiveId: objective.id } },
      update: { importance: 1 },
      create: { questionVersionId: question.id, learningObjectiveId: objective.id, importance: 1 },
    });
    const maxPoints = definition.criteria.reduce((sum, criterion) => sum + criterion.points, 0);
    const rubric = await db.questionRubric.upsert({
      where: { stableKey_version: { stableKey: `${definition.stableKey}:rubric`, version: 1 } },
      update: {
        questionVersionId: question.id,
        title: "Schemat punktowania próbnego sprawdzianu",
        sourceType: "CURRICULUM_DERIVED",
        scoringMode: "EXAM_POINTS",
        status: "APPROVED",
        sourceLocator: definition.sourceLocator,
        sourceVersion: "quick-classic-mock-v1",
        maxPoints,
      },
      create: {
        stableKey: `${definition.stableKey}:rubric`,
        version: 1,
        questionVersionId: question.id,
        title: "Schemat punktowania próbnego sprawdzianu",
        sourceType: "CURRICULUM_DERIVED",
        scoringMode: "EXAM_POINTS",
        status: "APPROVED",
        sourceLocator: definition.sourceLocator,
        sourceVersion: "quick-classic-mock-v1",
        maxPoints,
      },
    });
    for (const criterion of definition.criteria) {
      await db.rubricCriterion.upsert({
        where: { questionRubricId_code: { questionRubricId: rubric.id, code: criterion.code } },
        update: { description: criterion.description, required: true, points: criterion.points, evidenceLevel: "TRANSFER" },
        create: {
          questionRubricId: rubric.id,
          code: criterion.code,
          description: criterion.description,
          required: true,
          points: criterion.points,
          evidenceLevel: "TRANSFER",
        },
      });
    }
  }
}
