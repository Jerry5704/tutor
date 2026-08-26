import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { biologyTutorGuardrails } from "./curriculum-guardrails";
import { syncBaselineQuestionBank } from "./question-bank-seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const school = await db.school.create({ data: { name: "Liceum Ogólnokształcące w Głubczycach", city: "Głubczyce" } });
  const curriculum = await db.curriculumVersion.create({ data: {
    code: "PL-BIO-LO-2024",
    title: "Biologia LO — wersja MVP",
    tutorGuardrails: biologyTutorGuardrails,
  } });
  const subject = await db.subject.create({ data: { code: "BIO", name: "Biologia" } });
  const course = await db.course.create({ data: {
    schoolId: school.id, curriculumVersionId: curriculum.id, subjectId: subject.id,
    grade: 4, level: "ADVANCED", title: "Biologia — klasa IV, poziom rozszerzony",
  } });
  const unit = await db.unit.create({ data: { courseId: course.id, slug: "ewolucja", title: "Ewolucja", order: 1, description: "Mechanizmy i prawidłowości ewolucji biologicznej." } });
  const topic = await db.topic.create({ data: { unitId: unit.id, title: "Mechanizmy ewolucji", order: 1 } });
  const aids = {
    natural_selection: { hook: "Dlaczego antybiotyk może z czasem przestać działać?", microExplanation: "Dziedziczny wariant zwiększający sukces rozrodczy staje się częstszy w kolejnych pokoleniach.", workedExample: "Antybiotyk usuwa głównie bakterie wrażliwe. Odporne pozostawiają więcej potomstwa, więc odporność staje się częstsza.", practicePrompt: "Jak wielokrotne opryski wpłyną na dziedziczną odporność owadów na pestycyd? Wyjaśnij mechanizm.", visualData: { type: "sequence", caption: "Dobór zmienia populację między pokoleniami", steps: [{ label: "Zmienność", detail: "część bakterii jest odporna" }, { label: "Selekcja", detail: "giną głównie wrażliwe" }, { label: "Rozród", detail: "odporne zostawiają potomstwo" }, { label: "Zmiana", detail: "odporność jest częstsza" }] } },
    allele_frequency: { hook: "Populacja może ewoluować, choć pojedynczy organizm nie zmienia swoich genów podczas życia.", microExplanation: "Częstość allelu to jego udział w puli wszystkich kopii danego genu w populacji.", workedExample: "40 kopii A na 200 to 20%. Pokolenie później 70 na 200 to 35%.", practicePrompt: "Allel B wzrósł ze 100 do 250 kopii na 1000. Jak zmieniła się częstość i na jakim poziomie?", visualData: { type: "comparison", caption: "Częstość allelu przed i po zmianie", before: { label: "Pokolenie 1", primary: 20, secondary: 80 }, after: { label: "Pokolenie 2", primary: 35, secondary: 65 }, legend: "udział allelu A" } },
    genetic_drift: { hook: "Katastrofa może zmienić genetycznie populację bez selekcji.", microExplanation: "Dryf to losowa zmiana częstości alleli, szczególnie silna w małych populacjach.", workedExample: "Powódź losowo pozostawia głównie osobniki z allelem A, więc A staje się częstszy bez przewagi.", practicePrompt: "Po losowym pożarze zostają głównie osobniki z allelem B. Dlaczego B może stać się częstszy?", visualData: { type: "sequence", caption: "Losowy efekt w małej populacji", steps: [{ label: "Populacja", detail: "wiele alleli" }, { label: "Przypadek", detail: "losowe przeżycie" }, { label: "Ocaleni", detail: "częściej mają A" }, { label: "Pokolenie", detail: "A staje się częstszy" }] } },
    founder_effect: { hook: "Kilku założycieli może określić pulę genową przyszłej populacji.", microExplanation: "Mała grupa zabiera losową, niereprezentatywną część alleli populacji źródłowej.", workedExample: "Cztery z pięciu ptaków na nowej wyspie mają allel A, rzadki w populacji źródłowej.", practicePrompt: "Dwa z trzech nasion na wyspie mają rzadki allel R. Dlaczego R może być później częsty?", visualData: { type: "sequence", caption: "Założyciele są losową próbką", steps: [{ label: "Źródło", detail: "duża różnorodność" }, { label: "Założyciele", detail: "mała próba" }, { label: "Wyspa", detail: "izolacja" }, { label: "Populacja", detail: "inne częstości" }] } },
    speciation: { hook: "Rzeka może rozpocząć proces prowadzący do powstania dwóch gatunków.", microExplanation: "Ograniczenie przepływu genów pozwala populacjom niezależnie gromadzić różnice, aż powstanie izolacja rozrodcza.", workedExample: "Rzeka rozdziela populację; mutacje, dobór i dryf działają osobno; po wielu pokoleniach populacje nie wydają płodnego potomstwa.", practicePrompt: "Ułóż etapy od powstania kanionu do powstania dwóch gatunków gryzoni.", visualData: { type: "sequence", caption: "Specjacja jest procesem", steps: [{ label: "Bariera", detail: "rozdzielenie" }, { label: "Brak przepływu", detail: "geny się nie mieszają" }, { label: "Rozbieżność", detail: "mutacje, dobór, dryf" }, { label: "Izolacja rozrodcza", detail: "brak płodnego potomstwa" }, { label: "Dwa gatunki", detail: "specjacja" }] } },
  };
  const objectives = await Promise.all([
    ["natural_selection", "Dobór naturalny", 1, "Wyjaśnij mechanizm doboru naturalnego i zastosuj go w nowej sytuacji.", "Wyjaśnij własnymi słowami, jak dobór naturalny może sprawić, że dziedziczna cecha staje się częstsza w populacji.", "W populacji bakterii niektóre osobniki mają dziedziczną odporność na antybiotyk. Wyjaśnij mechanizm, przez który odporność może stać się częstsza po wielu pokoleniach.", 1.2, true],
    ["allele_frequency", "Częstość alleli w populacji", 2, "Powiąż zmianę częstości alleli ze zmianami zachodzącymi w populacji.", "Co oznacza, że częstość określonego allelu w populacji wzrosła z pokolenia na pokolenie?", "Częstość allelu A wzrosła w populacji z 20% do 35%. Co zmieniło się w populacji, a czego ten wynik nie mówi o pojedynczym osobniku?", 1, true],
    ["genetic_drift", "Dryf genetyczny", 3, "Wyjaśnij losowy charakter dryfu genetycznego i odróżnij go od doboru naturalnego.", "Dlaczego częstość allelu może zmienić się losowo, szczególnie w małej populacji?", "Przypadkowa powódź zabija połowę małej populacji niezależnie od cech osobników. Wyjaśnij, dlaczego częstości alleli po powodzi mogą być inne.", 1.1, true],
    ["founder_effect", "Efekt założyciela", 4, "Wyjaśnij efekt założyciela jako szczególny przypadek dryfu genetycznego.", "Niewielka grupa osobników zakłada nową, odizolowaną populację. Jak może to wpłynąć na częstości alleli?", "Pięć ptaków zasiedla wyspę i tworzy nową populację. Dlaczego jej pula alleli może różnić się od populacji wyjściowej, mimo braku przewagi adaptacyjnej?", 0.9, true],
    ["speciation", "Powstawanie gatunków", 5, "Wyjaśnij, jak izolacja i rozbieżność populacji mogą prowadzić do specjacji.", "Co musi wydarzyć się między dwiema populacjami jednego gatunku, aby z czasem mogły powstać dwa gatunki?", "Rzeka rozdziela jedną populację na dwie. Wyjaśnij, dlaczego samo rozdzielenie nie wystarcza jeszcze do powstania dwóch gatunków i co musi wydarzyć się później.", 1.2, true],
  ].map(([code, title, order, description, diagnosticPrompt, transferPrompt, importance, maturaRelevant]) => db.learningObjective.create({ data: {
    topicId: topic.id, code: String(code), title: String(title), order: Number(order), description: String(description), diagnosticPrompt: String(diagnosticPrompt), transferPrompt: String(transferPrompt), importance: Number(importance), maturaRelevant: Boolean(maturaRelevant), ...aids[String(code) as keyof typeof aids],
  } })));
  await Promise.all(objectives.map((objective) => syncBaselineQuestionBank(db, objective)));
  const source = await db.knowledgeSource.create({ data: {
    title: "Kontrolowane notatki autorskie — ewolucja MVP", sourceType: "EDITORIAL_NOTE",
    provenance: "Autorskie streszczenia pojęć do demonstracji mechanizmu retrieval.",
    rightsNote: "Treść własna projektu; bez fragmentów podręcznika.", status: "APPROVED",
    curricula: { create: { curriculumVersionId: curriculum.id } }, units: { create: { unitId: unit.id } },
    chunks: { create: [
      { locator: "natural-selection", content: "Dobór naturalny jest nielosową różnicą przeżywania i rozrodu osobników o dziedzicznych wariantach cech. Korzyść osobnika wpływa na populację dopiero przez różnice w sukcesie rozrodczym w kolejnych pokoleniach." },
      { locator: "drift", content: "Dryf genetyczny to losowa zmiana częstości alleli, szczególnie silna w małych populacjach. Efekt założyciela zachodzi, gdy nowa populacja powstaje z niewielkiej, niereprezentatywnej grupy osobników." },
      { locator: "speciation", content: "Specjacja wymaga powstania izolacji rozrodczej. Ograniczenie przepływu genów pozwala populacjom gromadzić różnice wskutek mutacji, doboru i dryfu." },
    ] },
  } });
  await db.knowledgeSourceObjective.createMany({ data: objectives.map((objective) => ({ sourceId: source.id, learningObjectiveId: objective.id })) });
  const user = await db.user.create({ data: { email: "uczen@example.com", passwordHash: await hash("Tutor123!", 12), profile: { create: { displayName: "Uczeń", enrollments: { create: { courseId: course.id } } } } }, include: { profile: true } });
  console.log(`Seeded ${user.email}`);
}

main().finally(() => db.$disconnect());
