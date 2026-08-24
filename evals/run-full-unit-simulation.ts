import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { db } from "../src/server/db/client";
import { OpenAIProvider } from "../src/server/ai/openai-provider";
import { TutorService } from "../src/server/services/tutor-service";

const studentReplySchema = z.object({ reply: z.string().min(1).max(900) });
const auditSchema = z.object({
  scores: z.object({
    naturalness: z.number().min(1).max(5),
    clarity: z.number().min(1).max(5),
    pedagogicalAdaptation: z.number().min(1).max(5),
    scientificPrecision: z.number().min(1).max(5),
  }),
  issues: z.array(z.object({
    turn: z.number().int(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    category: z.enum(["REPETITION", "ANSWER_LEAKAGE", "UNCLEAR_LANGUAGE", "UNNATURAL_DIALOGUE", "PEDAGOGY", "SCIENTIFIC_ACCURACY", "PROGRESS_LOGIC"]),
    excerpt: z.string(),
    explanation: z.string(),
    suggestedFix: z.string(),
  })),
  summary: z.string(),
});

type TraceRow = {
  turn: number;
  phaseBefore: string;
  phaseAfter: string;
  objectiveCode: string;
  objectiveTitle: string;
  learningStep: string | null;
  masteryBefore: number;
  masteryAfter: number;
  studentReply: string;
  tutorReply: string;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9 ]/gu, " ").replace(/\s+/gu, " ").trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 3));
}

function similarity(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const common = [...a].filter((token) => b.has(token)).length;
  return common / (a.size + b.size - common);
}

function lastQuestion(value: string) {
  return value.split(/\n+/gu).map((part) => part.trim()).filter(Boolean).findLast((part) => part.includes("?")) ?? "";
}

function ruleAudit(trace: TraceRow[]) {
  const issues: Array<{ turn: number; code: string; detail: string }> = [];
  for (let index = 0; index < trace.length; index += 1) {
    const row = trace[index];
    const wordCount = row.tutorReply.split(/\s+/gu).filter(Boolean).length;
    if (wordCount > 220) issues.push({ turn: row.turn, code: "TOO_LONG", detail: `${wordCount} słów` });
    if (index > 0) {
      const currentQuestion = lastQuestion(row.tutorReply);
      const previousQuestion = lastQuestion(trace[index - 1].tutorReply);
      const score = similarity(currentQuestion, previousQuestion);
      if (currentQuestion && previousQuestion && score >= 0.78) issues.push({ turn: row.turn, code: "NEAR_REPEATED_QUESTION", detail: `${score.toFixed(2)}: ${currentQuestion}` });
      if (trace[index - 1].phaseAfter === "LEARNING" && row.phaseAfter === "DIAGNOSTIC") issues.push({ turn: row.turn, code: "PHASE_REGRESSION", detail: row.objectiveCode });
    }
    const recentSameObjective = trace.slice(Math.max(0, index - 7), index + 1).filter((item) => item.objectiveCode === row.objectiveCode);
    if (recentSameObjective.length === 8) issues.push({ turn: row.turn, code: "OBJECTIVE_STALL", detail: row.objectiveCode });
  }
  return issues;
}

async function syntheticReply(client: OpenAI, state: {
  turn: number;
  phase: string;
  objectiveTitle: string;
  mastery: number;
  recentConversation: string;
}) {
  const response = await client.responses.parse({
    model: process.env.EVAL_STUDENT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    instructions: `Symulujesz jednego realistycznego polskiego ucznia IV klasy liceum przygotowującego się do sprawdzianu z całego działu genetyki molekularnej.
Na początku masz wyraźne, ale realistyczne luki. Dobrze kojarzysz jedynie budowę nukleotydu, komplementarność, podstawowe role RNA i ogólny mechanizm translacji. Częściowo rozumiesz replikację, gen/chromosom/genom i kod genetyczny, lecz mylisz szczegóły. Nie znasz dobrze enzymów replikacji, nici wiodącej i opóźnionej, zależności sekwencji w transkrypcji, obróbki RNA ani regulacji ekspresji. W diagnostyce odpowiadaj zgodnie z tym profilem: przy nieznanym mechanizmie napisz „nie wiem”, a przy częściowej wiedzy ujawnij typowy błąd. Nie wykorzystuj wiedzy modelu, której ta persona jeszcze nie otrzymała od tutora.
Podczas nauki naprawdę uczysz się z wyjaśnień i feedbacku. Zapamiętuj poprawki, odpowiadaj coraz trafniej własnymi słowami i stosuj wiedzę w nowych sytuacjach. Nie sabotuj postępu, ale nie przeskakuj od razu do eksperckiej odpowiedzi.
Pisz naturalnie jak uczeń: zwykle 1–5 zdań. Gdy tutor pyta, odpowiedz na pytanie. Gdy prosi tylko o potwierdzenie zrozumienia, odpowiedz „dalej” wyłącznie wtedy, gdy wyjaśnienie jest wystarczające. Nie oceniaj aplikacji i nie wychodź z roli.
Wcześniejsze wyjaśnienia w historii traktuj jako wiedzę, którą mogłeś zapamiętać, a nie tekst do mechanicznego kopiowania.`,
    input: JSON.stringify(state),
    text: { format: zodTextFormat(studentReplySchema, "full_unit_student_reply") },
  });
  if (!response.output_parsed) throw new Error("Synthetic student returned no reply");
  return response.output_parsed.reply;
}

async function auditTranscript(client: OpenAI, trace: TraceRow[]) {
  const compact = trace.map((row) => ({
    turn: row.turn,
    phase: `${row.phaseBefore}->${row.phaseAfter}`,
    objective: row.objectiveTitle,
    student: row.studentReply,
    tutor: row.tutorReply,
    mastery: `${row.masteryBefore.toFixed(2)}->${row.masteryAfter.toFixed(2)}`,
  }));
  const response = await client.responses.parse({
    model: process.env.EVAL_JUDGE_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    instructions: `Jesteś surowym ewaluatorem dialogu edukacyjnego z biologii rozszerzonej. Oceń pełny transkrypt po polsku.
Wykrywaj: pytanie powtórzone bez wartości pedagogicznej, odpowiedź widoczną tuż przed retrieval question, brak bezpośredniej odpowiedzi na prośbę ucznia, nienaturalne przejścia, niezrozumiały język, zbyt długie wykłady, błędny feedback, błędy biologiczne i mastery niezgodne z dowodami.
Jeśli uczeń wyraźnie napisał „nie wiem” lub poprosił o odpowiedź, bezpośrednie podanie poprawnej odpowiedzi jest wymaganym scaffoldingiem, a nie answer leakage. Oceń wtedy, czy odpowiedź była kompletna, zwięzła i dotyczyła dokładnie ostatniego pytania.
Nie oznaczaj jako błędu uzasadnionego ponownego sprawdzenia po feedbacku ani stopniowego scaffolding. Cytuj krótki fragment i podaj konkretną poprawkę.`,
    input: JSON.stringify(compact),
    text: { format: zodTextFormat(auditSchema, "full_unit_dialogue_audit") },
  });
  if (!response.output_parsed) throw new Error("Audit model returned no result");
  return response.output_parsed;
}

async function main() {
  if (process.env.EVALS_ALLOW_DATABASE_WRITES !== "true") throw new Error("Set EVALS_ALLOW_DATABASE_WRITES=true");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
  const unit = await db.unit.findFirstOrThrow({ where: { title: "Genetyka molekularna", course: { active: true } } });
  const runId = new Date().toISOString().replace(/[:.]/gu, "-");
  const user = await db.user.create({
    data: {
      email: `eval+${runId}-full-unit@synthetic.local`,
      passwordHash: await hash(crypto.randomUUID(), 4),
      isSynthetic: true,
      profile: { create: { displayName: "[EVAL] Pełny dział", enrollments: { create: { courseId: unit.courseId } } } },
    },
    include: { profile: true },
  });
  if (!user.profile) throw new Error("Synthetic profile missing");
  const tutor = new TutorService(new OpenAIProvider());
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const session = await tutor.start(user.profile.id, unit.id, "Pełny zakres działu; pytania otwarte i zadania w stylu sprawdzianowym.");
  const trace: TraceRow[] = [];
  const maxTurns = Number(process.env.EVAL_MAX_TURNS_FULL ?? 140);

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const before = await db.studySession.findUniqueOrThrow({
      where: { id: session.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        objectiveStates: true,
      },
    });
    if (before.endedAt || before.phase === "COMPLETED") break;
    if (!before.currentObjectiveId) throw new Error("Current objective missing");
    const objective = await db.learningObjective.findUniqueOrThrow({ where: { id: before.currentObjectiveId } });
    const objectiveState = before.objectiveStates.find((item) => item.learningObjectiveId === objective.id);
    if (before.phase === "LEARNING" && objectiveState?.learningStep === "EXPLAIN" && !before.awaitingUnderstandingCheck) {
      await tutor.beginPractice(user.profile.id, session.id);
      continue;
    }
    const masteryBefore = (await db.studentMastery.findUnique({
      where: { studentId_learningObjectiveId: { studentId: user.profile.id, learningObjectiveId: objective.id } },
    }))?.mastery ?? 0;
    const recentConversation = before.messages.slice(-12).map((message) => `${message.role === "TUTOR" ? "Tutor" : "Uczeń"}: ${message.content}`).join("\n\n");
    const reply = await syntheticReply(client, {
      turn,
      phase: before.phase,
      objectiveTitle: objective.title,
      mastery: masteryBefore,
      recentConversation,
    });
    await tutor.answer(user.profile.id, session.id, reply, `eval-full-${runId}-${turn}`);
    const after = await db.studySession.findUniqueOrThrow({
      where: { id: session.id },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const masteryAfter = (await db.studentMastery.findUnique({
      where: { studentId_learningObjectiveId: { studentId: user.profile.id, learningObjectiveId: objective.id } },
    }))?.mastery ?? masteryBefore;
    trace.push({
      turn,
      phaseBefore: before.phase,
      phaseAfter: after.phase,
      objectiveCode: objective.code,
      objectiveTitle: objective.title,
      learningStep: objectiveState?.learningStep ?? null,
      masteryBefore,
      masteryAfter,
      studentReply: reply,
      tutorReply: after.messages[0]?.content ?? "",
    });
    if (turn % 10 === 0) console.log(`Progress: ${turn}/${maxTurns}, phase=${after.phase}, objective=${objective.code}`);
  }

  const final = await db.studySession.findUniqueOrThrow({
    where: { id: session.id },
    include: { objectiveStates: { include: { learningObjective: true } } },
  });
  const masteries = await db.studentMastery.findMany({ where: { studentId: user.profile.id } });
  const masteryMap = new Map(masteries.map((item) => [item.learningObjectiveId, item]));
  const objectiveResults = final.objectiveStates.map((state) => ({
    code: state.learningObjective.code,
    title: state.learningObjective.title,
    status: state.status,
    mastery: masteryMap.get(state.learningObjectiveId)?.mastery ?? 0,
    confidence: masteryMap.get(state.learningObjectiveId)?.confidence ?? 0,
    attempts: masteryMap.get(state.learningObjectiveId)?.attempts ?? 0,
  }));
  const modelAudit = await auditTranscript(client, trace);
  const report = {
    runId,
    createdAt: new Date().toISOString(),
    sessionId: session.id,
    syntheticUserId: user.id,
    unit: { id: unit.id, title: unit.title },
    finalPhase: final.phase,
    completed: final.phase === "COMPLETED" && Boolean(final.endedAt),
    turns: trace.length,
    masteredObjectives: objectiveResults.filter((item) => item.status === "MASTERED").length,
    objectiveCount: objectiveResults.length,
    objectiveResults,
    ruleIssues: ruleAudit(trace),
    modelAudit,
    trace,
  };
  const outputDir = path.join(process.cwd(), "eval-results");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${runId}-full-unit.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`Full unit eval complete: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`Result: completed=${report.completed}, mastered=${report.masteredObjectives}/${report.objectiveCount}, turns=${report.turns}`);
}

main().finally(() => db.$disconnect());
