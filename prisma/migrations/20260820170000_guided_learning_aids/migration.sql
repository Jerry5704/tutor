CREATE TYPE "LearningStep" AS ENUM ('EXPLAIN', 'PRACTICE', 'TRANSFER');

ALTER TABLE "LearningObjective"
ADD COLUMN "hook" TEXT,
ADD COLUMN "microExplanation" TEXT,
ADD COLUMN "workedExample" TEXT,
ADD COLUMN "practicePrompt" TEXT,
ADD COLUMN "visualData" JSONB;

UPDATE "LearningObjective" SET
"hook" = CASE "code"
  WHEN 'natural_selection' THEN 'Dlaczego po kilku latach ten sam antybiotyk może przestać działać na część bakterii?'
  WHEN 'allele_frequency' THEN 'Populacja może ewoluować, mimo że żaden pojedynczy organizm nie zmienia swoich genów podczas życia.'
  WHEN 'genetic_drift' THEN 'Katastrofa może zmienić genetycznie populację, nawet jeśli ocalałe osobniki nie były lepiej przystosowane.'
  WHEN 'founder_effect' THEN 'Kilka osobników zasiedlających wyspę może zadecydować o puli genowej tysięcy przyszłych potomków.'
  WHEN 'speciation' THEN 'Jedna rzeka może rozpocząć proces, który po wielu pokoleniach zakończy się powstaniem dwóch gatunków.' END,
"microExplanation" = CASE "code"
  WHEN 'natural_selection' THEN 'W populacji występują dziedziczne warianty cech. Jeśli jeden wariant powoduje większy sukces rozrodczy w danych warunkach, jego nosiciele pozostawiają więcej potomstwa. Dlatego wariant staje się częstszy w kolejnych pokoleniach.'
  WHEN 'allele_frequency' THEN 'Częstość allelu opisuje udział danego wariantu genu w puli wszystkich kopii tego genu w populacji. Zmiana częstości zachodzi między pokoleniami na poziomie populacji, a nie wewnątrz pojedynczego osobnika.'
  WHEN 'genetic_drift' THEN 'Dryf genetyczny to losowa zmiana częstości alleli. Jest silniejszy w małych populacjach, ponieważ przypadkowe przeżycie lub rozród kilku osobników stanowi dużą część następnego pokolenia.'
  WHEN 'founder_effect' THEN 'Efekt założyciela zachodzi, gdy nową populację tworzy mała, niereprezentatywna grupa. Zabiera ona tylko przypadkową część alleli populacji wyjściowej, więc częstości od początku są inne.'
  WHEN 'speciation' THEN 'Bariera może najpierw ograniczyć przepływ genów. W odizolowanych populacjach mutacje, dobór i dryf działają niezależnie. Gdy nagromadzone różnice prowadzą do izolacji rozrodczej, populacje stają się odrębnymi gatunkami.' END,
"workedExample" = CASE "code"
  WHEN 'natural_selection' THEN 'Przed leczeniem 1 na 1000 bakterii ma dziedziczną odporność. Antybiotyk zabija głównie bakterie wrażliwe. Odporne częściej przeżywają i pozostawiają potomstwo, więc po wielu pokoleniach udział odporności rośnie.'
  WHEN 'allele_frequency' THEN 'W diploidalnej populacji 100 osobników istnieje 200 kopii genu. Jeśli 40 kopii to allel A, jego częstość wynosi 20%. Gdy w następnym pokoleniu jest 70 kopii A na 200, częstość wynosi 35%.'
  WHEN 'genetic_drift' THEN 'W małej populacji przypadkowa powódź pozostawia 10 osobników. Większość ocalałych przypadkiem ma allel A. Następne pokolenie zaczyna więc z większą częstością A, mimo że allel nie chronił przed powodzią.'
  WHEN 'founder_effect' THEN 'Na wyspę dociera pięć ptaków, z których cztery mają allel A. Populacja źródłowa miała tylko 20% tego allelu. Nowa populacja zaczyna z wysoką częstością A wskutek przypadkowego składu założycieli.'
  WHEN 'speciation' THEN 'Rzeka rozdziela populację. Przepływ genów ustaje, warunki po obu stronach są inne, a mutacje i dryf zachodzą niezależnie. Po wielu pokoleniach osobniki obu populacji nie wydają wspólnie płodnego potomstwa: powstała izolacja rozrodcza.' END,
"practicePrompt" = CASE "code"
  WHEN 'natural_selection' THEN 'W populacji owadów część ma dziedziczną odporność na pestycyd. Przewidź, co stanie się z częstością odporności po wielu opryskach i wyjaśnij mechanizm.'
  WHEN 'allele_frequency' THEN 'W puli 1000 kopii genu allel B występował 100 razy, a pokolenie później 250 razy. Jak zmieniła się jego częstość i na jakim poziomie zaszła ta zmiana?'
  WHEN 'genetic_drift' THEN 'Po losowym pożarze z małej populacji zostają głównie osobniki z allelem B, który nie dawał ochrony. Wyjaśnij, dlaczego B może stać się częstszy.'
  WHEN 'founder_effect' THEN 'Trzy nasiona przypadkowo trafiają na odległą wyspę. Dwa mają rzadki allel R. Dlaczego R może być częsty w przyszłej populacji wyspy?'
  WHEN 'speciation' THEN 'Kanion rozdziela populację gryzoni. Ułóż kolejne etapy od powstania bariery do powstania dwóch gatunków.' END,
"visualData" = CASE "code"
  WHEN 'natural_selection' THEN '{"type":"sequence","caption":"Dobór zmienia populację między pokoleniami","steps":[{"label":"Zmienność","detail":"część bakterii jest odporna"},{"label":"Selekcja","detail":"antybiotyk usuwa głównie wrażliwe"},{"label":"Rozród","detail":"odporne zostawiają więcej potomstwa"},{"label":"Zmiana populacji","detail":"odporność staje się częstsza"}]}'::jsonb
  WHEN 'allele_frequency' THEN '{"type":"comparison","caption":"Częstość allelu przed i po zmianie","before":{"label":"Pokolenie 1","primary":20,"secondary":80},"after":{"label":"Pokolenie 2","primary":35,"secondary":65},"legend":"udział allelu A w puli genowej"}'::jsonb
  WHEN 'genetic_drift' THEN '{"type":"sequence","caption":"Losowy efekt jest silny w małej populacji","steps":[{"label":"Mała populacja","detail":"dwa allele występują w puli"},{"label":"Losowe zdarzenie","detail":"przeżycie nie zależy od cechy"},{"label":"Nieliczni ocaleni","detail":"przypadkowo częściej mają allel A"},{"label":"Nowe pokolenie","detail":"częstość A rośnie bez przewagi"}]}'::jsonb
  WHEN 'founder_effect' THEN '{"type":"sequence","caption":"Założyciele są losową próbką populacji","steps":[{"label":"Populacja źródłowa","detail":"duża różnorodność alleli"},{"label":"5 założycieli","detail":"zabierają tylko część puli"},{"label":"Izolowana wyspa","detail":"brak dopływu genów"},{"label":"Nowa populacja","detail":"inne częstości alleli"}]}'::jsonb
  WHEN 'speciation' THEN '{"type":"sequence","caption":"Specjacja jest procesem, nie pojedynczym zdarzeniem","steps":[{"label":"Bariera","detail":"rzeka rozdziela populację"},{"label":"Brak przepływu genów","detail":"pule genowe przestają się mieszać"},{"label":"Rozbieżność","detail":"mutacje, dobór i dryf działają niezależnie"},{"label":"Izolacja rozrodcza","detail":"populacje nie wydają płodnego potomstwa"},{"label":"Dwa gatunki","detail":"proces specjacji zakończony"}]}'::jsonb END;

ALTER TABLE "LearningObjective" ALTER COLUMN "hook" SET NOT NULL,
ALTER COLUMN "microExplanation" SET NOT NULL,
ALTER COLUMN "workedExample" SET NOT NULL,
ALTER COLUMN "practicePrompt" SET NOT NULL,
ALTER COLUMN "visualData" SET NOT NULL;

ALTER TABLE "SessionObjectiveState"
ADD COLUMN "consecutiveStruggles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "workedExamplesShown" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "learningStep" "LearningStep" NOT NULL DEFAULT 'EXPLAIN';

ALTER TABLE "TutorMessage" ADD COLUMN "learningObjectiveId" TEXT,
ADD COLUMN "showVisual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentAnswer" ADD COLUMN "submissionId" TEXT;
CREATE UNIQUE INDEX "StudentAnswer_submissionId_key" ON "StudentAnswer"("submissionId");
