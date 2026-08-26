# Tutor biologii

Produkcyjny vertical slice adaptacyjnego AI Tutora dla uczniów IV klasy liceum,
uczących się biologii na poziomie rozszerzonym. Pierwszy zakres jest celowo
wąski, ale model domenowy pozwala później dodawać szkoły, klasy, przedmioty i
wersje podstawy programowej.

## Decyzje architektoniczne

- **Next.js + TypeScript** jako jeden wdrażalny serwis webowy. UI i backend
  pozostają w jednym repozytorium, lecz logika domenowa nie zależy od Reacta.
- **PostgreSQL + Prisma** zapewniają relacyjny model, migracje i jawne więzy
  integralności.
- **OpenAI Responses API** działa wyłącznie po stronie serwera. Model pochodzi
  ze zmiennej `OPENAI_MODEL`, a klucz nigdy nie trafia do przeglądarki.
- **AIProvider** izoluje SDK OpenAI. **TutorService** orkiestruje przebieg sesji,
  a **AssessmentService**, **StudentModelService** i **CurriculumService** mają
  osobne odpowiedzialności i można je testować bez wywołań LLM.
- Odpowiedź dla ucznia i ocena maszynowa powstają razem jako Structured Output
  walidowany schematem Zod. Surowy tekst modelu nie jest parsowany regexami.
- Każda zmiana mastery wynikająca z oceny AI ma audytowalny rekord
  `Assessment` albo `ConceptAssessment`, zawierający ocenę, poziom dowodu,
  wartość przed i po zmianie, wskazane cele i identyfikator odpowiedzi API.
- Struktura curriculum, źródła wiedzy i logika tutoringu są rozdzielone.
  Materiał biologiczny jest seedowany jako dane, nigdy w komponentach UI.
- Wskaźnik gotowości jest ważoną średnią mastery aktywnych LearningObjectives,
  a nie prognozą oceny.

## Moduły

```text
src/
  app/                    routing, server actions i UI
  components/             proste komponenty prezentacyjne
  server/
    ai/                   AIProvider, OpenAIProvider i schematy odpowiedzi
    prompts/              małe, wersjonowane instrukcje pedagogiczne
    services/             Curriculum, StudentModel, Assessment, Tutor
    auth/                 sesja ucznia i bezpieczne cookie
    db/                   klient Prisma
  domain/                 typy i reguły niezależne od frameworka
prisma/
  schema.prisma           relacyjny model danych
  migrations/             migracje produkcyjne
  seed.ts                 kontrolowane dane curriculum MVP
```

Żądanie ucznia przechodzi przez server action do `TutorService`. Serwis pobiera
cele i mastery przez `CurriculumService`/`StudentModelService`, wybiera aktualny
cel, pobiera dozwolony kontekst wiedzy, a następnie wywołuje `AIProvider`.
`AssessmentService` zapisuje odpowiedź strukturalną i atomowo aktualizuje
mastery. UI otrzymuje tylko tekst tutorski i aktualny stan sesji.

## Model danych

Główne relacje:

```text
School -> CurriculumVersion -> Subject -> Course -> Unit -> Topic
                                                   Topic -> LearningObjective
KnowledgeSource -> KnowledgeChunk -> (CurriculumVersion/Unit/Topic/Objective)

User -> StudentProfile -> StudySession -> TutorMessage / StudentAnswer
StudentProfile -> StudentMastery -> LearningObjective
StudentAnswer -> Assessment -> AssessmentObjective -> LearningObjective
Assessment -> AssessmentMisconception -> Misconception
StudySession -> TeacherScopeNote
StudentProfile -> ReviewSchedule -> LearningObjective
```

`Course` wiąże przedmiot, klasę, poziom, szkołę i wersję curriculum. Dzięki temu
dzisiejszy kurs „Biologia, IV LO, rozszerzenie, Głubczyce” nie blokuje kolejnych
wariantów. `LearningObjective` ma stabilny kod, wagę, `maturaRelevant` oraz
opcjonalne `maturaRequirementId`.

`StudentMastery` przechowuje heurystyczne `mastery`, `confidence`, liczbę prób i
`lastPracticedAt`. `ReviewSchedule` od początku rezerwuje pola `dueAt`, interwał,
łatwość i liczbę powtórek pod przyszłe spaced repetition, bez implementowania
algorytmu w MVP.

`StudySession` ma fazę `DIAGNOSTIC`, `PLAN`, `LEARNING`, `MOCK_EXAM` lub
`COMPLETED`. Diagnostyka jest obowiązkowa dla nowego działu. Stan sesji wskazuje
bieżący cel, poziom scaffoldingu i liczbę prób, dzięki czemu dialog można
wznowić bez polegania wyłącznie na historii czatu.

## Wiedza i RAG

`KnowledgeSource` opisuje pochodzenie, status prawny, wersję i zakres materiału.
`KnowledgeChunk` przechowuje treść, metadane oraz opcjonalny embedding; tabele
wiążą fragment z curriculum i konkretnymi celami. Retrieval najpierw filtruje po
aktualnym kursie i LearningObjective, a dopiero później szereguje fragmenty.

Tutor dostaje jedynie relewantne, zatwierdzone fragmenty. Gdy baza wiedzy nie
wspiera odpowiedzi zależnej od materiału źródłowego, ma ujawnić brak podstawy,
a nie dopowiadać faktów. MVP używa krótkich, kontrolowanych notatek zapisanych
w seedzie; nie zawiera tekstu podręcznika.

### Lokalny OCR legalnie posiadanego podręcznika

Pliki źródłowe i wynik OCR nie są commitowane. Dla pierwszego działu książki
`Biologia na czasie 4` (strony książki 6-64, strony PDF 8-66):

```bash
npm run ocr:setup
npm run ocr:unit-1
npm run db:seed:unit-1
npm run db:ingest:unit-1
npm run db:seed:quick-unit
```

`db:seed:quick-unit` dodaje jako dział 2 krótki, dwucelowy zakres testowy z
początku rozdziału „Genetyka klasyczna” (strony 66–74). Zawiera kontrolowane
opracowanie źródłowe do RAG i służy do szybkiego przejścia pełnej ścieżki nauki.

Każda strona trafia do osobnego pliku tekstowego w
`materials/derived/biologia-na-czasie-4/unit-1/pages`. `manifest.json` zachowuje
zakres stron, wersję OCR i sumę kontrolną PDF-a. Obrazy stron są materiałem
roboczym do kontroli schematów i również pozostają wyłącznie lokalnie.

Import jest idempotentny. Zapisuje po jednym kontrolowanym fragmencie na stronę,
z numerem strony książki i PDF-a, typem sekcji, wersją OCR oraz sumą kontrolną
źródła. Powiązania z curriculum, działem, tematami i celami są przechowywane
oddzielnie od samego tekstu.

Wybrane ilustracje źródłowe są udostępniane wyłącznie zalogowanemu uczniowi
przez autoryzowany endpoint `/api/source-assets/[assetId]`. Asset ID jest
mapowany na jawnie dozwolony plik (bez ścieżki podanej przez użytkownika), a
odpowiedź ma prywatny cache. Wdrożenie publiczne wymaga potwierdzenia praw do
redystrybucji ilustracji albo zastąpienia ich własnymi diagramami.

## Strukturalny plan sprawdzianu

Nowa sesja wymaga zatwierdzonego `TestPlan`. Uczeń podaje datę sprawdzianu,
dostępny czas dzienny i opcjonalną notatkę nauczyciela. Model może zwrócić tylko
strukturalną sugestię dla kodów `LearningObjective` przekazanych z curriculum;
nieznane kody są ignorowane, a niejednoznaczność nie wyklucza materiału.

Na ekranie przeglądu uczeń jawnie zatwierdza każdy cel jako `INCLUDED`,
`PRIORITY` albo `EXCLUDED`. Dopiero `confirmedScope` wpływa na diagnostykę,
kolejność nauki i gotowość do danego sprawdzianu. `EXCLUDED` nie usuwa celu z
curriculum, ogólnego mastery działu ani przyszłego profilu maturalnego.
Dashboard pokazuje osobno gotowość do zatwierdzonego zakresu i mastery całego
działu. Sesja zachowuje `testPlanId`, więc późniejsza zmiana planu nie zmienia
historycznego kontekstu już przeprowadzonej nauki.

## Kontrolowany bank pytań i rubryki

`QuestionItemVersion` przechowuje wersjonowane pytanie niezależnie od kodu
tutora. Pytanie ma cel użycia (`DIAGNOSTIC`, `PRACTICE`, `TRANSFER`, `REVIEW`
lub `MOCK_EXAM`), format, trudność, oczekiwany poziom dowodu i jawne
pochodzenie. Relacja `QuestionObjective` pozwala jednemu zadaniu sprawdzać kilka
LearningObjectives. Tutor wybiera zatwierdzone pytanie deterministycznie i
najpierw unika wersji już użytych w bieżącej sesji.

Każda wersja może mieć wersjonowane `QuestionRubric` i `RubricCriterion`.
Źródła są rozróżniane bez mieszania ich znaczenia:

- `CKE_EXACT` oznacza kryteria przepisane z konkretnego, wskazanego oficjalnego
  zadania i schematu oceniania;
- `CKE_DERIVED` oznacza autorskie zadanie wzorowane na jawnych wymaganiach CKE,
  a nie oficjalny klucz;
- `TEACHER_SPECIFIC` jest nakładką dotyczącą formy lub oczekiwań konkretnego
  sprawdzianu i nie stanowi źródła faktów biologicznych;
- `CURRICULUM_DERIVED` oraz `INTERNAL_LEARNING` służą odpowiednio kryteriom
  wynikającym z celu curriculum i ćwiczeniom dydaktycznym aplikacji.

Początkowy bank migruje dotychczasowe pytania jako kontrolowane wersje bazowe;
nie udaje rubryk CKE. Oficjalne kryterium CKE można zatwierdzić dopiero razem z
`sourceLocator` i wersją dokumentu. Responses API zwraca wynik każdego
przekazanego kryterium w Structured Output. Backend usuwa obce lub powtórzone
kody, ogranicza ocenę, gdy wymagane kryterium nie zostało spełnione, i zapisuje
`AssessmentCriterionResult`. `TutorMessage` oraz `Assessment` zachowują ID
dokładnej wersji pytania i rubryki, więc późniejsza edycja banku nie zmienia
historycznego uzasadnienia mastery.

## Próbny sprawdzian

Próbny sprawdzian jest osobnym procesem od rozmowy z tutorem. `MockExamAttempt`
zamraża zatwierdzony `TestPlan`, wersje pytań, rubryki, kryteria i readiness z
chwili startu. Uczeń widzi jedno pytanie naraz oraz limit czasu; podczas
rozwiązywania nie ma podpowiedzi, feedbacku, czatu pobocznego ani dostępu do
wcześniejszych wyjaśnień. Może oddać podejście wcześniej, a brak odpowiedzi
otrzymuje zero punktów.

Wszystkie odpowiedzi z jednego podejścia są oceniane jednym wywołaniem
Responses API dopiero po oddaniu. Model oznacza wyłącznie przekazane kryteria,
natomiast backend odrzuca obce identyfikatory i sam wylicza punkty. Brakujący
wynik kryterium jest traktowany jako niespełniony, więc błąd modelu nie może
zawyżyć wyniku. `MockExamCriterionResult` zachowuje dowód dla każdego punktu, a
`MockExamObjectiveResult` agreguje wynik według LearningObjective.

Readiness do konkretnego sprawdzianu pozostaje mastery z nauki do chwili
pierwszego ocenionego podejścia. Później jest liczony per cel jako 60% dowodów z
nauki i transferu oraz 40% najnowszego próbnego sprawdzianu. Obie składowe są
heurystyką opanowania materiału, nie prognozą szkolnej oceny. Wynik poniżej 80%
dla celu może uruchomić sesję naprawczą obejmującą wyłącznie wykryte braki.

Bank próbny obejmuje dwucelowy dział testowy oraz pełny dział „Genetyka
molekularna”. Dla każdego celu są dwa unikalne zadania oparte na kontrolowanych
fragmentach podręcznika, z lokalizatorem stron i jawną rubryką punktową. Test
kompletności pilnuje liczby zadań, unikalności, źródeł i kryteriów. Inne działy
nie pokazują przycisku sprawdzianu, dopóki każdy cel zatwierdzonego zakresu nie
ma co najmniej dwóch zatwierdzonych zadań `MOCK_EXAM` z punktową rubryką.
Bank zachowuje dwa warianty, ale podejście obejmujące więcej niż dwa cele wybiera
po jednym zadaniu na cel. Dla całego działu daje to 15 zadań i około 45 minut;
krótki dwucelowy dział nadal wykorzystuje oba warianty każdego celu. Kolejne
podejście zaczyna od innego wariantu, aby nie powtarzać zawsze tego samego testu.

## Pedagogiczna maszyna stanów

1. `DIAGNOSTIC`: samodzielne wyjaśnienie obejmujące cele działu; znany cel jest
   pomijany, luka lub misconception powoduje pytanie pogłębiające.
2. `PLAN`: krótkie podsumowanie mocnych stron i priorytetów.
3. `LEARNING`: krótkie wyjaśnienie -> próba ucznia -> analiza -> feedback ->
   retrieval/transfer. Pomoc rośnie od 0 do 4, a po worked example natychmiast
   następuje podobne zadanie.
4. `MOCK_EXAM`: bez podpowiedzi; wynik kieruje z powrotem do konkretnych luk.

Tutor nie uznaje samej definicji za mastery: wysoki poziom wymaga poprawnego
wyjaśnienia mechanizmu i transferu do nowego kontekstu.

## Bezpieczeństwo i obserwowalność

- Hasła są haszowane, sesje są `httpOnly`, `sameSite=lax` i w produkcji `secure`.
- Dane wejściowe są walidowane po stronie serwera; operacje sprawdzają właściciela
  sesji i kursu.
- Logi zawierają identyfikatory żądań, sesji, wersję prompta, model, opóźnienie,
  usage i wynik walidacji, ale nie klucze ani pełne odpowiedzi ucznia.
- Produkcyjny deployment docelowo: AWS App Runner lub ECS Fargate, RDS
  PostgreSQL, Secrets Manager, CloudWatch i S3 dla legalnych materiałów.
- `/api/health` służy jako lekki liveness check procesu, a `/api/ready`
  potwierdza dostępność PostgreSQL bez ujawniania szczegółów połączenia.
- Płatne akcje AI mają trwały, współdzielony limit PostgreSQL na ucznia.
  Progi konfiguruje się przez `AI_RATE_LIMIT_PER_10_MINUTES` i
  `AI_RATE_LIMIT_PER_DAY`; odrzucenie nie zmienia mastery ani nie wywołuje API.
- Każde wywołanie AI zapisuje centralne zdarzenie `AiUsageEvent`: funkcję,
  model i wersję prompta, status, opóźnienie oraz raportowane przez Responses API
  tokeny wejściowe, cache, wyjściowe i rozumowania. Rejestr nie zawiera prompta,
  odpowiedzi ucznia, klucza API ani pełnej odpowiedzi modelu.
- Szacowany koszt jest wyliczany w chwili wywołania, a użyte stawki zostają przy
  zdarzeniu do późniejszego audytu. Aktualne stawki konfiguruje się przez
  `OPENAI_INPUT_USD_PER_1M_TOKENS`, `OPENAI_CACHED_INPUT_USD_PER_1M_TOKENS`
  i `OPENAI_OUTPUT_USD_PER_1M_TOKENS`. Wartości domyślne dotyczą wyłącznie
  domyślnego `gpt-5.4-mini`; dla innego modelu należy ustawić wszystkie trzy.
- `/usage` pokazuje zalogowanemu uczniowi wyłącznie jego zagregowane użycie i
  koszty według funkcji. Są to szacunki bez podatków, rabatów i korekt faktury.
- `LearningEvent` zapisuje zdarzenia potrzebne do oceny pilotażu (m.in. start,
  pauzę, wznowienie, czas odpowiedzi, pytanie poboczne i szybkie wyjaśnienie),
  ale nie treść wypowiedzi. Pod każdą odpowiedzią tutora uczeń może wskazać
  „pomogło” albo „nie pomogło”; wybór można później zmienić.

## Konfiguracja lokalna

Wymagane są Node.js 24 i PostgreSQL. Skopiuj `.env.example` do `.env`, ustaw
`DATABASE_URL`, co najmniej 32-znakowy `AUTH_SECRET`, `OPENAI_API_KEY` oraz
opcjonalnie `OPENAI_MODEL`, a następnie uruchom:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Seed tworzy konto `uczen@example.com` z hasłem `Tutor123!`; służy ono wyłącznie
do lokalnego vertical slice i przed wdrożeniem musi zostać zastąpione normalnym
procesem rejestracji/provisioningu. Aplikacja jest dostępna pod
`http://localhost:3000`.

### Obraz produkcyjny

Repozytorium zawiera wieloetapowy `Dockerfile` dla trybu standalone Next.js.
Obraz działa jako użytkownik bez uprawnień roota i nie zawiera `.env`, PDF-a,
OCR ani lokalnych ilustracji podręcznika:

```bash
docker build -t tutor-biologii .
docker run --rm -p 3000:3000 --env-file .env tutor-biologii
```

Na środowisku publicznym migracje uruchamia się jako osobny krok wdrożenia,
przed podmianą działającej wersji aplikacji.

Workflow GitHub Actions dla `main` i pull requestów sprawdza lockfile, generuje
klienta Prisma oraz uruchamia lint, typecheck i produkcyjny build. Nie korzysta
z prawdziwych sekretów, bazy ani OpenAI API.

Zmienne znajdują się w `.env.example`: `DATABASE_URL`, `AUTH_SECRET`,
`OPENAI_API_KEY`, `OPENAI_MODEL`, `INTERNET_VISUALS_ENABLED`. Ustawienie
`INTERNET_VISUALS_ENABLED=false` wyłącza wyszukiwanie ilustracji w Wikimedia
Commons. Model nie jest używany w logice biznesowej;
wartość domyślna jest tylko konfiguracją providera i można ją zmienić bez zmian
w `TutorService`.

### Ilustracje podczas rozmowy

Tutor najpierw wybiera zatwierdzony zasób przypisany do aktualnego celu nauki,
w szczególności ilustrację przygotowaną z legalnie dostępnego podręcznika. Gdy
takiego zasobu nie ma albo uczeń prosi o inną ilustrację, aplikacja odpytuje
Wikimedia Commons. Akceptuje wyłącznie obrazy dostarczone przez zaufaną domenę
Wikimedia z licencją CC0, Public Domain, CC BY lub CC BY-SA. W bazie zapisuje
autora, licencję, stronę źródłową i zapytanie użyte podczas wyszukiwania.
Konkretny zasób jest przypisany do `TutorMessage`, dzięki czemu historia rozmowy
nie zmienia ilustracji po czasie. Zewnętrzny obraz jest udostępniany przez
kontrolowany endpoint aplikacji, który nie proxy'uje dowolnych domen.

Lokalnie ilustracje podręcznika są odczytywane z katalogu `materials/derived`.
W kontenerze produkcyjnym ustaw `SOURCE_ASSET_STORAGE=s3`,
`SOURCE_ASSET_S3_BUCKET`, opcjonalny `SOURCE_ASSET_S3_PREFIX` oraz `AWS_REGION`.
Aplikacja korzysta ze standardowego łańcucha poświadczeń AWS SDK, więc na ECS
lub App Runner należy nadać roli zadania wyłącznie `s3:GetObject` dla tego
prefiksu; kluczy AWS nie zapisuje się w `.env`.

Po utworzeniu prywatnego bucketu lokalne ilustracje można wysłać standardowym
AWS CLI, bez publikowania ich w Git:

```bash
aws s3 sync materials/derived/biologia-na-czasie-4/unit-1/assets \
  s3://NAZWA-BUCKETU/textbook/unit-1/assets
```

## Zakres pierwszego vertical slice

Logowanie ucznia, dashboard jednego kursu, wybór działu, notatka nauczyciela,
obowiązkowa diagnostyka, adaptacyjna rozmowa, zapis assessment/mastery, wznowienie
sesji i gotowość działu. Import dokumentów, pełny harmonogram powtórek, panel
administratora i próbny sprawdzian pozostają poza pierwszym commitem.

## Wirtualna klasa do ewaluacji

Laboratorium prowadzi sześć jawnie oznaczonych syntetycznych person — od ucznia
nieznającego działu po ucznia zaawansowanego — przez cały dział genetyki
molekularnej. Każda persona ma z góry określone granice wiedzy i błędne modele
mentalne dla wszystkich LearningObjectives. Diagnostyczne „nie wiem” oraz
misconceptions są deterministyczne, więc model symulujący ucznia nie może
potajemnie korzystać z wiedzy eksperckiej.

Runner korzysta z prawdziwych `TutorService`, `SideChatService` i
`ConceptTutorService`, zapisuje oddzielnych syntetycznych użytkowników oraz
śledzi mastery przed i po każdej odpowiedzi. Raport JSON i czytelny raport HTML
w `eval-results/` zawierają pełny dialog, przejścia faz, źródła, tokeny, koszt
(jeśli podano aktualne stawki), audyt reguł oraz niezależną ocenę drugiego
wywołania modelu opartą na kontrolowanych materiałach.

```bash
# wymagane: dział i źródła są już zaimportowane, PostgreSQL działa
EVALS_ALLOW_DATABASE_WRITES=true npm run eval:pilot
EVALS_ALLOW_DATABASE_WRITES=true npm run eval:synthetic-class
```

Pilot uruchamia personę początkującą i zaawansowaną. Pełna klasa uruchamia sześć
person po jednej iteracji. `EVAL_STUDENT_MODEL` i `EVAL_JUDGE_MODEL` pozwalają
oddzielić model ucznia i sędziego od `OPENAI_MODEL`. `EVAL_MAX_TURNS`,
`EVAL_MAX_OBJECTIVE_TURNS` oraz `EVAL_MAX_CONCEPT_TURNS` są bezpiecznikami, nie
docelową długością sesji. Przekroczenie limitu celu kończy daną personę wynikiem
FAIL zamiast finansować zapętloną rozmowę.
Opcjonalne `EVAL_INPUT_USD_PER_MILLION` i `EVAL_OUTPUT_USD_PER_MILLION` pozwalają
policzyć koszt według aktualnego cennika bez hardcodowania go w repozytorium.

Uruchomienie jest celowo blokowane bez `EVALS_ALLOW_DATABASE_WRITES=true`, bo
wykonuje płatne wywołania OpenAI i zapisuje audytowalne dane syntetyczne do bazy.
Nie należy uruchamiać tego skryptu w CI ani przeciw produkcyjnej bazie uczniów.

Uruchomienie zapisuje dane w bazie i wykonuje wiele wywołań OpenAI API, dlatego
wymaga jawnej flagi:

```bash
EVALS_ALLOW_DATABASE_WRITES=true npm run eval:synthetic-class
```

Koszt i czas można ograniczyć przez `EVAL_MAX_TURNS` oraz osobny
`EVAL_STUDENT_MODEL`. Konta mają `User.isSynthetic=true`, więc można je odróżnić
od prawdziwych uczniów i wykluczać z analityki produktu.
