import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { biologyTutorGuardrails } from "./curriculum-guardrails";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type ObjectiveSeed = {
  code: string;
  title: string;
  description: string;
  diagnosticPrompt: string;
  practicePrompt: string;
  transferPrompt: string;
  microExplanation: string;
  workedExample?: string;
};

type TopicSeed = {
  title: string;
  bookPages: string;
  objectives: ObjectiveSeed[];
};

const topics: TopicSeed[] = [
  {
    title: "1.1. Budowa i rola kwasów nukleinowych",
    bookPages: "6-15",
    objectives: [
      {
        code: "mol_nucleotide_structure",
        title: "Budowa nukleotydu i nici kwasu nukleinowego",
        description: "Rozpoznaje elementy nukleotydu oraz wyjaśnia powstawanie łańcucha polinukleotydowego i jego polarność.",
        diagnosticPrompt: "Wyobraź sobie DNA jako bardzo długi łańcuch złożony z powtarzalnych elementów. Jak nazywa się jeden taki element i z jakich części jest zbudowany?",
        practicePrompt: "Wyjaśnij własnymi słowami, czym jest nić DNA i czym jest pojedynczy nukleotyd. Możesz użyć porównania do sznurka z koralikami.",
        transferPrompt: "Na schemacie łańcucha brakuje reszty fosforanowej między dwoma cukrami. Przewidź skutek dla ciągłości nici i uzasadnij.",
        microExplanation: "Nić DNA to jedna bardzo długa cząsteczka przypominająca sznurek z ogromnej liczby połączonych elementów. Każdy „koralik” to nukleotyd: ma cukier, resztę fosforanową i zasadę azotową. Cukier z fosforanem tworzą powtarzalny szkielet nici, a zasady wystają z niego jak kolorowe części koralików. Oznaczenia 5′ i 3′ opisują dwa różne końce tego chemicznego sznurka — zajmiemy się nimi dopiero po zrozumieniu samej nici.",
      },
      {
        code: "mol_dna_structure_complementarity",
        title: "Podwójna helisa i komplementarność DNA",
        description: "Wyjaśnia antyrównoległość, komplementarność i stabilizację podwójnej helisy oraz zapisuje nić komplementarną.",
        diagnosticPrompt: "Dla nici 5′-ACGTT-3′ zapisz nić komplementarną wraz z kierunkami i wyjaśnij swój zapis.",
        practicePrompt: "Dwa fragmenty DNA mają taką samą długość, ale pierwszy zawiera więcej par G-C. Dlaczego do rozdzielenia jego nici potrzeba zwykle wyższej temperatury? Wyjaśnij cały mechanizm.",
        transferPrompt: "W próbce A jest 30% par G-C, a w próbce B — 70%. Oba fragmenty mają taką samą długość i są w tych samych warunkach. Która próbka ma wyższą temperaturę rozdzielenia nici: A czy B? Porównaj je bezpośrednio i uzasadnij.",
        microExplanation: "Dwie nici DNA są antyrównoległe: gdy jedna biegnie 5′→3′, druga biegnie 3′→5′. Zasady łączą się komplementarnie: A z T za pomocą dwóch wiązań wodorowych, a G z C za pomocą trzech. Dlatego we fragmentach tej samej długości i w tych samych warunkach większy udział par G-C oznacza zwykle więcej wiązań wodorowych do zerwania podczas rozdzielania nici. Ogrzewanie dostarcza energii cieplnej potrzebnej do przerwania tych oddziaływań, więc fragment bogatszy w G-C rozdziela się zwykle przy wyższej temperaturze. Samo słowo „stabilniejszy” jest tylko skrótem tego mechanizmu.",
        workedExample: "Porównaj dwa fragmenty po 100 par zasad. Fragment A zawiera 30 par G-C, a fragment B 70 par G-C. Fragment B ma więcej par połączonych trzema wiązaniami wodorowymi, więc do rozdzielenia jego nici trzeba dostarczyć więcej energii cieplnej; dlatego jego temperatura rozdzielenia będzie zwykle wyższa. To porównanie zakłada taką samą długość fragmentów i takie same pozostałe warunki.",
      },
      {
        code: "mol_dna_rna_comparison",
        title: "Porównanie DNA i rodzajów RNA",
        description: "Porównuje budowę i funkcje DNA oraz RNA i wiąże mRNA, tRNA i rRNA z biosyntezą białka.",
        diagnosticPrompt: "Porównaj DNA i RNA pod względem cukru, zasad, typowej liczby nici i podstawowej funkcji.",
        practicePrompt: "Wyjaśnij, jak role mRNA, tRNA i rRNA uzupełniają się podczas syntezy białka.",
        transferPrompt: "W cząsteczce znaleziono rybozę i uracyl. Co można, a czego nie można wywnioskować o jej funkcji?",
        microExplanation: "DNA zwykle przechowuje informację, a różne rodzaje RNA uczestniczą w jej wykorzystaniu. Sama budowa RNA nie przesądza jeszcze o jego konkretnym rodzaju.",
      },
    ],
  },
  {
    title: "1.2. Replikacja DNA",
    bookPages: "16-26",
    objectives: [
      {
        code: "mol_replication_mechanism",
        title: "Semikonserwatywny mechanizm replikacji",
        description: "Wyjaśnia cel, miejsce w cyklu i semikonserwatywny przebieg replikacji DNA.",
        diagnosticPrompt: "Dlaczego replikację DNA nazywa się semikonserwatywną i jakie znaczenie ma przed podziałem komórki?",
        practicePrompt: "Opisz los obu nici jednej cząsteczki DNA podczas replikacji, nie wymieniając tylko nazw etapów.",
        transferPrompt: "Po jednym cyklu replikacji w znakowanym środowisku każda cząsteczka ma jedną nić starą i jedną nową. Wyjaśnij ten wynik.",
        microExplanation: "Każda stara nić jest matrycą nowej nici, dlatego cząsteczka potomna zachowuje jedną nić macierzystą.",
      },
      {
        code: "mol_replication_enzymes",
        title: "Enzymy i kierunek syntezy DNA",
        description: "Łączy funkcje helikazy, prymazy, polimerazy i ligazy z kierunkiem syntezy DNA.",
        diagnosticPrompt: "Jak współdziałają helikaza, prymaza, polimeraza DNA i ligaza podczas replikacji?",
        practicePrompt: "Dlaczego polimeraza potrzebuje startera i do którego końca dołącza kolejne nukleotydy?",
        transferPrompt: "Przewidź bezpośredni skutek zahamowania ligazy dla nowo powstającego DNA i uzasadnij.",
        microExplanation: "Helikaza rozdziela nici, prymaza tworzy starter, polimeraza wydłuża tylko koniec 3′, a ligaza łączy fragmenty.",
      },
      {
        code: "mol_leading_lagging_strands",
        title: "Nić wiodąca, opóźniona i oczko replikacyjne",
        description: "Rozpoznaje na schemacie nici wiodące i opóźnione oraz wyjaśnia syntezę fragmentów Okazaki.",
        diagnosticPrompt: "Dlaczego jedna nowa nić powstaje ciągle, a druga fragmentami, skoro obie polimerazy syntetyzują 5′→3′?",
        practicePrompt: "Jak na schemacie widełek rozpoznasz nić opóźnioną? Podaj kryterium, nie zgaduj położenia.",
        transferPrompt: "Widełki przesuwają się w prawo, a matryca biegnie w tym kierunku 5′→3′. Określ sposób syntezy nowej nici i uzasadnij.",
        microExplanation: "Antyrównoległość matryc i jeden kierunek pracy polimerazy powodują syntezę ciągłą na jednej oraz nieciągłą na drugiej nici.",
      },
    ],
  },
  {
    title: "1.3. Geny i genomy",
    bookPages: "27-34",
    objectives: [
      {
        code: "mol_gene_structure",
        title: "Struktura genu i rodzaje sekwencji",
        description: "Rozróżnia części regulatorowe, eksony i introny oraz geny ciągłe i nieciągłe.",
        diagnosticPrompt: "Czym różnią się ekson, intron i część regulatorowa genu pod względem roli?",
        practicePrompt: "Dlaczego gen eukariotyczny może być dłuższy od dojrzałego mRNA powstałego na jego podstawie?",
        transferPrompt: "Mutacja zaszła w promotorze, a sekwencja białka się nie zmieniła. Wyjaśnij, jak mimo tego może zmienić się ilość białka.",
        microExplanation: "Gen obejmuje część regulatorową i strukturalną; w genach nieciągłych pierwotny transkrypt zawiera eksony oraz usuwane introny.",
      },
      {
        code: "mol_genome_organization",
        title: "Organizacja genomów pro- i eukariotycznych",
        description: "Porównuje organizację genomów oraz odróżnia gen, chromosom i genom.",
        diagnosticPrompt: "Wyjaśnij różnicę między genem, chromosomem i genomem oraz podaj ich wzajemne powiązanie.",
        practicePrompt: "Porównaj typowe rozmieszczenie DNA w komórce bakteryjnej i eukariotycznej.",
        transferPrompt: "Komórka ma kolisty chromosom i małe dodatkowe cząsteczki DNA. Zidentyfikuj te elementy i uzasadnij.",
        microExplanation: "Gen jest funkcjonalnym odcinkiem DNA, chromosom organizuje długą cząsteczkę DNA, a genom obejmuje całą informację genetyczną.",
      },
    ],
  },
  {
    title: "1.4. Ekspresja genów",
    bookPages: "35-48",
    objectives: [
      {
        code: "mol_genetic_code",
        title: "Kod genetyczny i praca z tabelą kodonów",
        description: "Wyjaśnia cechy kodu genetycznego i ustala aminokwasy na podstawie kodonów mRNA.",
        diagnosticPrompt: "Wyjaśnij cechy kodu genetycznego: trójkowy, jednoznaczny, zdegenerowany, bezprzecinkowy, niezachodzący i uniwersalny. Jeśli nie pamiętasz wszystkich, wyjaśnij te, które znasz.",
        practicePrompt: "Korzystając z zależności między nićmi, wyznacz kodon mRNA dla trypletu matrycy DNA 3′-TAC-5′.",
        transferPrompt: "Dwa różne kodony wyznaczają ten sam aminokwas. Która cecha kodu to wyjaśnia i dlaczego nie przeczy jednoznaczności?",
        microExplanation: "Kodon to trójka nukleotydów mRNA. Kodony są odczytywane kolejno, bez przerw i bez nakładania się. Jeden kodon ma jedno znaczenie, jeden aminokwas może mieć kilka kodonów, a reguły kodu są niemal uniwersalne.",
      },
      {
        code: "mol_transcription",
        title: "Transkrypcja i zależności między sekwencjami",
        description: "Wyjaśnia transkrypcję oraz zapisuje sekwencje nici matrycowej, kodującej i RNA z polarnością.",
        diagnosticPrompt: "Jaką rolę ma nić matrycowa podczas transkrypcji i jaka jest relacja mRNA do nici kodującej?",
        practicePrompt: "Dla matrycy 3′-TAC GGA-5′ zapisz mRNA wraz z kierunkiem.",
        transferPrompt: "Mutacja zmienia zasadę w nici kodującej. Pokaż kolejno, jak może zmienić kodon mRNA i produkt translacji.",
        microExplanation: "Polimeraza RNA odczytuje matrycę 3′→5′ i syntetyzuje komplementarny RNA 5′→3′; odpowiada on nici kodującej z U zamiast T.",
      },
      {
        code: "mol_rna_processing",
        title: "Obróbka potranskrypcyjna RNA",
        description: "Wyjaśnia splicing i alternatywne składanie oraz ich znaczenie dla produktów genu.",
        diagnosticPrompt: "Co dzieje się z pre-mRNA, zanim stanie się dojrzałym mRNA u eukariontów?",
        practicePrompt: "Dlaczego alternatywne składanie może prowadzić do powstania różnych białek na podstawie jednego genu?",
        transferPrompt: "Uszkodzenie miejsca wycinania intronu pozostawia intron w mRNA. Przewidź możliwy skutek dla białka.",
        microExplanation: "Podczas splicingu usuwa się introny i łączy eksony; różne kombinacje eksonów mogą tworzyć różne dojrzałe mRNA.",
      },
      {
        code: "mol_translation",
        title: "Mechanizm translacji",
        description: "Łączy role mRNA, tRNA i rybosomu oraz wyznacza antykodony i kolejność aminokwasów.",
        diagnosticPrompt: "Jak współdziałają mRNA, tRNA i rybosom podczas powstawania łańcucha polipeptydowego?",
        practicePrompt: "Dla kodonu mRNA 5′-UGG-3′ zapisz antykodon tRNA z kierunkami i wyjaśnij komplementarność.",
        transferPrompt: "Mutacja tworzy przedwczesny kodon STOP. Przewidź wpływ na długość i możliwą funkcję białka.",
        microExplanation: "Rybosom odczytuje kodony mRNA, tRNA dostarcza odpowiadające aminokwasy, a wiązania peptydowe tworzą polipeptyd.",
      },
    ],
  },
  {
    title: "1.5. Regulacja ekspresji genów",
    bookPages: "49-58",
    objectives: [
      {
        code: "mol_prokaryotic_regulation",
        title: "Regulacja operonów bakteryjnych",
        description: "Analizuje elementy operonu i przewiduje wpływ warunków środowiska oraz mutacji na transkrypcję.",
        diagnosticPrompt: "Jak operator, promotor, represor i geny struktury współdziałają w operonie?",
        practicePrompt: "Wyjaśnij, dlaczego obecność laktozy może umożliwić transkrypcję genów potrzebnych do jej wykorzystania.",
        transferPrompt: "Represor nie może związać operatora. Przewidź ekspresję genów struktury przy braku substratu i uzasadnij.",
        microExplanation: "Operon grupuje geny pod wspólną kontrolą; białka regulatorowe wpływają na dostęp polimerazy RNA do transkrypcji.",
      },
      {
        code: "mol_eukaryotic_regulation",
        title: "Regulacja ekspresji u eukariontów",
        description: "Porównuje regulację na poziomie chromatyny, transkrypcji, obróbki RNA, translacji i białka.",
        diagnosticPrompt: "Na jakich etapach od DNA do aktywnego białka komórka eukariotyczna może regulować ekspresję genu?",
        practicePrompt: "Wyjaśnij, jak kondensacja chromatyny może zmniejszyć ilość powstającego białka.",
        transferPrompt: "mRNA powstaje w zwykłej ilości, ale białka jest mało. Wskaż dwa możliwe poziomy regulacji po transkrypcji.",
        microExplanation: "Eukarionty regulują dostępność DNA, transkrypcję, obróbkę i trwałość RNA, translację oraz aktywność i trwałość białek.",
      },
      {
        code: "mol_cell_differentiation",
        title: "Regulacja genów a różnicowanie komórek",
        description: "Wyjaśnia, jak komórki o tym samym genomie uzyskują różną budowę i funkcję.",
        diagnosticPrompt: "Dlaczego neuron i komórka mięśniowa mogą działać inaczej, mimo że mają zasadniczo ten sam genom?",
        practicePrompt: "Połącz różną aktywność genów z różnym zestawem białek i funkcją dwóch typów komórek.",
        transferPrompt: "Gen jest obecny w komórkach wątroby i skóry, ale jego białko występuje tylko w wątrobie. Wyjaśnij mechanizm bez odwoływania się do utraty genu.",
        microExplanation: "Różne typy komórek aktywują różne zestawy genów, dlatego wytwarzają inne białka mimo posiadania tego samego DNA.",
      },
    ],
  },
];

const sequenceVisuals: Record<string, { caption: string; steps: Array<{ label: string; detail: string }> }> = {
  mol_dna_structure_complementarity: {
    caption: "Co utrzymuje razem dwie nici DNA?",
    steps: [
      { label: "Dwie przeciwne nici", detail: "jedna biegnie 5′→3′, druga 3′→5′" },
      { label: "Pary zasad", detail: "A łączy się z T, a G z C" },
      { label: "Wiązania wodorowe", detail: "A–T tworzy 2, a G–C 3 takie wiązania" },
      { label: "Ogrzewanie", detail: "dostarcza energii potrzebnej do rozdzielenia nici" },
    ],
  },
  mol_dna_rna_comparison: {
    caption: "Od informacji w DNA do wykorzystania jej przez RNA",
    steps: [
      { label: "DNA", detail: "przechowuje sekwencję informacji genetycznej" },
      { label: "mRNA", detail: "przenosi kopię informacji do rybosomu" },
      { label: "rRNA", detail: "współtworzy rybosom" },
      { label: "tRNA", detail: "dostarcza aminokwas zgodny z kodonem mRNA" },
    ],
  },
  mol_replication_enzymes: {
    caption: "Współpraca enzymów podczas replikacji DNA",
    steps: [
      { label: "Helikaza", detail: "rozdziela dwie nici DNA" },
      { label: "Prymaza", detail: "tworzy krótki starter z wolnym końcem 3′" },
      { label: "Polimeraza DNA", detail: "dołącza nukleotydy do końca 3′ nowej nici" },
      { label: "Ligaza", detail: "łączy sąsiednie fragmenty nowej nici" },
    ],
  },
  mol_leading_lagging_strands: {
    caption: "Dlaczego jedna nić powstaje ciągle, a druga fragmentami?",
    steps: [
      { label: "Matryce są antyrównoległe", detail: "przy widełkach biegną w przeciwnych kierunkach" },
      { label: "Jedna reguła polimerazy", detail: "nowa nić zawsze rośnie 5′→3′" },
      { label: "Nić wiodąca", detail: "może rosnąć ciągle w kierunku ruchu widełek" },
      { label: "Nić opóźniona", detail: "powstaje odcinkami — fragmentami Okazaki" },
      { label: "Ligaza", detail: "scala fragmenty Okazaki w jedną nić" },
    ],
  },
  mol_gene_structure: {
    caption: "Od genu nieciągłego do dojrzałego mRNA",
    steps: [
      { label: "Część regulatorowa", detail: "wpływa na rozpoczęcie i intensywność transkrypcji" },
      { label: "Eksony i introny", detail: "obie sekwencje trafiają do pierwotnego transkryptu" },
      { label: "Splicing", detail: "introny są usuwane, a eksony łączone" },
      { label: "Dojrzałe mRNA", detail: "jest krótsze od pierwotnego transkryptu" },
    ],
  },
  mol_genome_organization: {
    caption: "Gen, chromosom i genom — relacja skali",
    steps: [
      { label: "Gen", detail: "funkcjonalny odcinek DNA" },
      { label: "Chromosom", detail: "długa cząsteczka DNA zawierająca wiele genów" },
      { label: "Genom", detail: "całość informacji genetycznej organizmu" },
    ],
  },
  mol_genetic_code: {
    caption: "Jak odczytywana jest sekwencja mRNA?",
    steps: [
      { label: "Kierunek 5′→3′", detail: "rybosom przesuwa się wzdłuż mRNA" },
      { label: "Kodon", detail: "kolejne trzy nukleotydy tworzą jedną jednostkę odczytu" },
      { label: "Znaczenie kodonu", detail: "wskazuje aminokwas albo sygnał STOP" },
      { label: "Łańcuch", detail: "aminokwasy są dołączane w kolejności kodonów" },
    ],
  },
  mol_transcription: {
    caption: "Przepisanie informacji z DNA na RNA",
    steps: [
      { label: "Nić matrycowa DNA", detail: "polimeraza RNA odczytuje ją 3′→5′" },
      { label: "Dobór nukleotydów", detail: "powstający RNA jest komplementarny do matrycy" },
      { label: "Wzrost RNA", detail: "nowa cząsteczka jest syntetyzowana 5′→3′" },
      { label: "Relacja do nici kodującej", detail: "ta sama sekwencja z U zamiast T" },
    ],
  },
  mol_rna_processing: {
    caption: "Obróbka pierwotnego transkryptu RNA",
    steps: [
      { label: "pre-mRNA", detail: "zawiera eksony i introny" },
      { label: "Wycięcie intronów", detail: "sekwencje intronowe są usuwane" },
      { label: "Połączenie eksonów", detail: "eksony tworzą ciągłą sekwencję" },
      { label: "Dojrzałe mRNA", detail: "może zostać wykorzystane podczas translacji" },
    ],
  },
  mol_translation: {
    caption: "Współpraca mRNA, tRNA i rybosomu",
    steps: [
      { label: "Kodon mRNA", detail: "rybosom odczytuje kolejną trójkę nukleotydów" },
      { label: "Antykodon tRNA", detail: "wiąże się komplementarnie z kodonem" },
      { label: "Aminokwas", detail: "tRNA dostarcza właściwy aminokwas" },
      { label: "Wiązanie peptydowe", detail: "rybosom dołącza aminokwas do polipeptydu" },
    ],
  },
  mol_prokaryotic_regulation: {
    caption: "Jak represor steruje transkrypcją operonu?",
    steps: [
      { label: "Represor na operatorze", detail: "blokuje przejście polimerazy RNA" },
      { label: "Sygnał środowiskowy", detail: "zmienia zdolność represora do wiązania operatora" },
      { label: "Operator dostępny", detail: "polimeraza może transkrybować geny struktury" },
      { label: "Wspólne mRNA", detail: "produkty genów pomagają odpowiedzieć na warunki środowiska" },
    ],
  },
  mol_eukaryotic_regulation: {
    caption: "Miejsca regulacji od DNA do aktywnego białka",
    steps: [
      { label: "Dostępność DNA", detail: "stopień kondensacji chromatyny" },
      { label: "Transkrypcja", detail: "częstość powstawania RNA" },
      { label: "RNA", detail: "obróbka, transport i trwałość mRNA" },
      { label: "Translacja", detail: "częstość syntezy polipeptydu" },
      { label: "Białko", detail: "aktywacja, modyfikacje i rozkład" },
    ],
  },
  mol_cell_differentiation: {
    caption: "Ten sam genom, różne funkcje komórek",
    steps: [
      { label: "Ten sam zestaw genów", detail: "neuron i komórka mięśniowa mają zasadniczo ten sam genom" },
      { label: "Różna aktywność genów", detail: "w każdym typie komórki aktywne są inne zestawy genów" },
      { label: "Różne białka", detail: "komórki wytwarzają inne zestawy białek" },
      { label: "Różna budowa i funkcja", detail: "białka nadają komórkom ich specjalizację" },
    ],
  },
};

const visualFor = (objective: ObjectiveSeed) => {
  if (objective.code === "mol_nucleotide_structure") return {
        type: "source-image",
        assetId: "nucleotide-dna-page-6",
        caption: "Jeden nukleotyd DNA — pojedynczy „koralik” nici",
        alt: "Schemat nukleotydu DNA z resztą fosforanową, deoksyrybozą i zasadą azotową",
        sourceLabel: "Biologia na czasie 4, s. 6 — prywatny materiał źródłowy",
        parts: [
          { label: "Żółte koło", detail: "reszta fosforanowa" },
          { label: "Pomarańczowy pięciokąt", detail: "cukier — deoksyryboza" },
          { label: "Niebieski pierścień", detail: "jedna zasada azotowa" },
        ],
      };
  if (objective.code === "mol_replication_mechanism") return {
    type: "strand-inheritance",
    caption: "Dlaczego replikacja DNA jest semikonserwatywna?",
    parentLabel: "Jedna cząsteczka rodzicielska",
    processLabel: "nici rozdzielają się; do każdej powstaje nowa nić komplementarna",
    daughterLabel: "Dwie cząsteczki potomne",
    oldStrandLabel: "nić rodzicielska",
    newStrandLabel: "nić nowo zsyntetyzowana",
    conclusion: "Każda cząsteczka potomna zachowuje jedną z dwóch nici rodzicielskich i zawiera jedną nić nową.",
  };
  const visual = sequenceVisuals[objective.code];
  if (!visual) throw new Error(`Missing controlled visual for ${objective.code}`);
  return { type: "sequence", ...visual };
};

async function main() {
  const course = await db.course.findFirst({
    where: { subject: { code: "BIO" }, grade: 4, level: "ADVANCED" },
    include: { units: true },
  });
  if (!course) throw new Error("Biology grade 4 advanced course is missing. Run npm run db:seed first.");
  await db.curriculumVersion.update({
    where: { id: course.curriculumVersionId },
    data: { tutorGuardrails: biologyTutorGuardrails },
  });

  const evolution = course.units.find((unit) => unit.slug === "ewolucja");
  if (evolution?.order === 1) {
    await db.unit.update({ where: { id: evolution.id }, data: { order: 5 } });
  }

  const unit = await db.unit.upsert({
    where: { courseId_slug: { courseId: course.id, slug: "genetyka-molekularna" } },
    update: {
      title: "Genetyka molekularna",
      order: 1,
      description: "Budowa i funkcja kwasów nukleinowych, replikacja, organizacja genomu, ekspresja i regulacja genów.",
    },
    create: {
      courseId: course.id,
      slug: "genetyka-molekularna",
      title: "Genetyka molekularna",
      order: 1,
      description: "Budowa i funkcja kwasów nukleinowych, replikacja, organizacja genomu, ekspresja i regulacja genów.",
    },
  });

  for (const [topicIndex, topicSeed] of topics.entries()) {
    const topic = await db.topic.upsert({
      where: { unitId_order: { unitId: unit.id, order: topicIndex + 1 } },
      update: { title: topicSeed.title },
      create: { unitId: unit.id, order: topicIndex + 1, title: topicSeed.title },
    });

    for (const [objectiveIndex, objective] of topicSeed.objectives.entries()) {
      await db.learningObjective.upsert({
        where: { code: objective.code },
        update: {
          topicId: topic.id,
          order: objectiveIndex + 1,
          title: objective.title,
          description: objective.description,
          diagnosticPrompt: objective.diagnosticPrompt,
          practicePrompt: objective.practicePrompt,
          transferPrompt: objective.transferPrompt,
          microExplanation: objective.microExplanation,
          hook: `Zobaczmy, jak ${objective.title.toLocaleLowerCase("pl-PL")} działa w konkretnym mechanizmie.`,
          workedExample: objective.workedExample ?? `${objective.microExplanation} Najpierw nazwij elementy prostymi słowami, potem opisz ich połączenie, a dopiero na końcu użyj terminów biologicznych.`,
          visualData: visualFor(objective),
          maturaRelevant: true,
          active: true,
        },
        create: {
          topicId: topic.id,
          code: objective.code,
          order: objectiveIndex + 1,
          title: objective.title,
          description: objective.description,
          diagnosticPrompt: objective.diagnosticPrompt,
          practicePrompt: objective.practicePrompt,
          transferPrompt: objective.transferPrompt,
          hook: `Zobaczmy, jak ${objective.title.toLocaleLowerCase("pl-PL")} działa w konkretnym mechanizmie.`,
          microExplanation: objective.microExplanation,
          workedExample: objective.workedExample ?? `${objective.microExplanation} Najpierw wskaż dane, następnie mechanizm, a na końcu biologiczny skutek.`,
          visualData: visualFor(objective),
          importance: 1,
          maturaRelevant: true,
          maturaRequirementId: null,
          active: true,
        },
      });
    }

    console.log(`${topicSeed.title} (${topicSeed.bookPages}): ${topicSeed.objectives.length} objectives`);
  }

  const textbookSource = await db.knowledgeSource.findFirst({
    where: { sourceType: "USER_PROVIDED_TEXTBOOK_OCR", units: { some: { unitId: unit.id } } },
  });
  const assetSeeds = [
    {
      key: "nucleotide-dna-page-6",
      objectiveCode: "mol_nucleotide_structure",
      localFileName: "nucleotide-dna-page-6.png",
      sourcePage: 6,
      caption: "Jeden nukleotyd DNA — pojedynczy element nici",
      altText: "Schemat nukleotydu DNA z resztą fosforanową, deoksyrybozą i zasadą azotową",
    },
    {
      key: "dna-double-helix-page-8",
      objectiveCode: "mol_dna_structure_complementarity",
      localFileName: "dna-double-helix-page-8.png",
      sourcePage: 8,
      caption: "Podwójna helisa oraz antyrównoległe nici DNA",
      altText: "Schemat podwójnej helisy DNA, szkieletu cukrowo-fosforanowego, par zasad oraz przeciwnych kierunków nici",
    },
    {
      key: "rna-types-page-14",
      objectiveCode: "mol_dna_rna_comparison",
      localFileName: "rna-types-page-14.png",
      sourcePage: 14,
      caption: "Główne rodzaje RNA: mRNA, rRNA i tRNA",
      altText: "Porównanie budowy i funkcji informacyjnego, rybosomowego i transportującego RNA",
    },
  ];
  for (const asset of assetSeeds) {
    const objective = await db.learningObjective.findUniqueOrThrow({ where: { code: asset.objectiveCode } });
    await db.knowledgeAsset.upsert({
      where: { key: asset.key },
      update: {
        learningObjectiveId: objective.id,
        knowledgeSourceId: textbookSource?.id,
        localFileName: asset.localFileName,
        sourcePage: asset.sourcePage,
        caption: asset.caption,
        altText: asset.altText,
        status: "APPROVED",
      },
      create: {
        key: asset.key,
        learningObjectiveId: objective.id,
        knowledgeSourceId: textbookSource?.id,
        sourceType: "TEXTBOOK",
        localFileName: asset.localFileName,
        sourcePage: asset.sourcePage,
        caption: asset.caption,
        altText: asset.altText,
        attribution: `Biologia na czasie 4, s. ${asset.sourcePage}`,
        rightsNote: "Prywatne użycie legalnie posiadanego egzemplarza; nie publikować bez praw do redystrybucji.",
        priority: 10,
        status: "APPROVED",
        metadata: { answerRevealing: false, review: "manual_crop_reviewed" },
      },
    });
  }

  console.log(`Seeded unit 1 with ${topics.reduce((sum, topic) => sum + topic.objectives.length, 0)} objectives.`);
}

main().finally(() => db.$disconnect());
