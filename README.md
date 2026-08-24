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
```

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

## Zakres pierwszego vertical slice

Logowanie ucznia, dashboard jednego kursu, wybór działu, notatka nauczyciela,
obowiązkowa diagnostyka, adaptacyjna rozmowa, zapis assessment/mastery, wznowienie
sesji i gotowość działu. Import dokumentów, pełny harmonogram powtórek, panel
administratora i próbny sprawdzian pozostają poza pierwszym commitem.

## Wirtualna klasa do ewaluacji

Komenda `npm run eval:synthetic-class` prowadzi czterech oznaczonych jako
syntetyczni uczniów przez pierwszy aktywny dział i zapisuje raport JSON oraz HTML
w lokalnym katalogu `eval-results/`. Symulacje korzystają z prawdziwego
`TutorService`, dlatego wykrywają problemy z przejściami faz i trwałym modelem
ucznia, a nie tylko jakość pojedynczej odpowiedzi modelu. Raport wskazuje m.in.
powtórzone pytania, akapity, ilustracje i cofnięcie fazy nauki do diagnostyki.

Uruchomienie zapisuje dane w bazie i wykonuje wiele wywołań OpenAI API, dlatego
wymaga jawnej flagi:

```bash
EVALS_ALLOW_DATABASE_WRITES=true npm run eval:synthetic-class
```

Koszt i czas można ograniczyć przez `EVAL_MAX_TURNS` oraz osobny
`EVAL_STUDENT_MODEL`. Konta mają `User.isSynthetic=true`, więc można je odróżnić
od prawdziwych uczniów i wykluczać z analityki produktu.
