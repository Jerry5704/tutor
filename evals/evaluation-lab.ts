import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { OpenAIProvider } from "../src/server/ai/openai-provider";
import { db } from "../src/server/db/client";
import { ConceptTutorService } from "../src/server/services/concept-tutor-service";
import { KnowledgeService } from "../src/server/services/knowledge-service";
import { SideChatService } from "../src/server/services/side-chat-service";
import { TutorService } from "../src/server/services/tutor-service";
import {
  levelFor,
  misconceptionAnswers,
  objectiveCodes,
  partialAnswers,
  personas,
  type KnowledgeLevel,
  type ObjectiveCode,
  type SyntheticPersona,
} from "./personas";

const studentReplySchema = z.object({
  reply: z.string().min(1).max(900),
  selfAssessment: z.enum(["UNCERTAIN", "PARTIAL", "CONFIDENT"]),
  usedOnlyAvailableKnowledge: z.boolean(),
});

const judgeSchema = z.object({
  scores: z.object({
    naturalness: z.number().int().min(1).max(5),
    clarity: z.number().int().min(1).max(5),
    pedagogicalAdaptation: z.number().int().min(1).max(5),
    scientificPrecision: z.number().int().min(1).max(5),
    sourceGrounding: z.number().int().min(1).max(5),
    masteryCalibration: z.number().int().min(1).max(5),
  }),
  issues: z.array(z.object({
    turn: z.number().int(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    category: z.enum([
      "REPETITION",
      "ANSWER_LEAKAGE",
      "UNCLEAR_LANGUAGE",
      "UNNATURAL_DIALOGUE",
      "PEDAGOGY",
      "SCIENTIFIC_ACCURACY",
      "SOURCE_GROUNDING",
      "PROGRESS_LOGIC",
    ]),
    excerpt: z.string(),
    explanation: z.string(),
    suggestedFix: z.string(),
  })),
  verdict: z.enum(["PASS", "NEEDS_WORK", "FAIL"]),
  summary: z.string(),
});

type Severity = "LOW" | "MEDIUM" | "HIGH";
type RuleIssue = { turn: number; severity: Severity; code: string; detail: string };
type Usage = { inputTokens: number; outputTokens: number };

export type TraceRow = {
  turn: number;
  channel: "MAIN" | "SIDE" | "CONCEPT";
  phaseBefore: string;
  phaseAfter: string;
  objectiveCode: string;
  objectiveTitle: string;
  learningStep: string | null;
  prompt: string;
  studentReply: string;
  tutorReply: string;
  masteryBefore: number;
  masteryAfter: number;
  assessment: string | null;
  studentIntent: string | null;
  evidenceLevel: string | null;
  masteryDelta: number;
  sourceLocators: string[];
  tutorInputTokens: number;
  tutorOutputTokens: number;
  studentInputTokens: number;
  studentOutputTokens: number;
};

type Objective = {
  id: string;
  code: string;
  title: string;
  description: string;
  microExplanation: string;
  workedExample: string;
};

export type EvalOptions = {
  personaIds: string[];
  repetitions: number;
  maxTurns: number;
  maxObjectiveTurns: number;
  maxConceptTurns: number;
  judge: boolean;
  label: string;
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

function explicitHelp(value: string) {
  return /\b(?:nie wiem|nie rozumiem|wytłumacz|wyjaśnij|sam mi|podaj odpowiedź|powiedz mi)\b/iu.test(value);
}

function locators(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (!value || typeof value !== "object") return [];
  const accepted = (value as { acceptedCitations?: unknown }).acceptedCitations;
  return Array.isArray(accepted) ? accepted.filter((item): item is string => typeof item === "string") : [];
}

function deterministicDiagnostic(persona: SyntheticPersona, code: ObjectiveCode, level: KnowledgeLevel) {
  if (level === "UNKNOWN") return persona.id === "terse" ? "nie wiem" : "Nie wiem jeszcze — wróćmy do tego podczas nauki.";
  if (level === "MISCONCEPTION") return misconceptionAnswers[code] ?? partialAnswers[code];
  if (level === "PARTIAL") return partialAnswers[code];
}

async function modelStudentReply(params: {
  client: OpenAI;
  model: string;
  persona: SyntheticPersona;
  phase: string;
  objective: Objective;
  initialLevel: KnowledgeLevel;
  learningAttempt: number;
  recentConversation: string;
  allowReferenceKnowledge: boolean;
}) {
  const { client, model, persona, phase, objective, initialLevel, learningAttempt, recentConversation, allowReferenceKnowledge } = params;
  const response = await client.responses.parse({
    model,
    instructions: `Symulujesz realistycznego polskiego ucznia IV klasy liceum uczącego się biologii rozszerzonej.
Profil: ${persona.name}. ${persona.style}
Początkowy poziom dla aktualnego celu: ${initialLevel}. Faza: ${phase}. Próba podczas nauki: ${learningAttempt}.
Odpowiadaj wyłącznie jako uczeń, naturalnie, zwykle w 1–5 zdaniach. Nie oceniaj aplikacji i nie wychodź z roli.
Nie korzystaj z wiedzy biologicznej, której ten uczeń nie posiadał i której tutor nie przekazał w rozmowie.
W fazie nauki możesz używać informacji przekazanych wcześniej przez tutora, ale nie kopiuj jego zdań dosłownie.
Jeśli po pierwszym wyjaśnieniu mechanizm nadal jest trudny, dopuszczalna jest odpowiedź częściowa. Przy kolejnych próbach ucz się z feedbacku.
Jeżeli tutor prosi tylko o potwierdzenie zrozumienia i wyjaśnienie jest wystarczające, odpowiedz krótko „dalej”.
${allowReferenceKnowledge ? `Ta persona zna już poniższy zakres i może go samodzielnie zastosować:
${objective.description}
${objective.microExplanation}` : "Nie otrzymujesz żadnej dodatkowej wiedzy poza historią rozmowy."}`,
    input: JSON.stringify({ objective: objective.title, recentConversation }),
    text: { format: zodTextFormat(studentReplySchema, "evaluation_student_reply") },
  });
  if (!response.output_parsed) throw new Error("Synthetic student returned no structured reply");
  return {
    reply: response.output_parsed.reply,
    usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
  };
}

async function mastery(studentId: string, objectiveId: string) {
  return (await db.studentMastery.findUnique({
    where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } },
  }))?.mastery ?? 0;
}

async function assessmentFor(submissionId: string) {
  return db.studentAnswer.findUnique({
    where: { submissionId },
    include: { assessment: true },
  });
}

async function runConceptBranch(params: {
  studentId: string;
  studySessionId: string;
  conceptSlug: string;
  objective: Objective;
  persona: SyntheticPersona;
  client: OpenAI;
  studentModel: string;
  trace: TraceRow[];
  maxTurns: number;
  ai: OpenAIProvider;
}) {
  const { studentId, studySessionId, conceptSlug, objective, persona, client, studentModel, trace, maxTurns, ai } = params;
  const service = new ConceptTutorService(ai);
  const conceptSession = await service.start(studentId, studySessionId, conceptSlug, "NOT_FAMILIAR");
  for (let attempt = 1; attempt <= maxTurns; attempt += 1) {
    const before = await db.conceptSession.findUniqueOrThrow({
      where: { id: conceptSession.id },
      include: { concept: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (before.status === "COMPLETED") return true;
    const prompt = before.messages.findLast((message) => message.role === "TUTOR")?.content ?? "";
    const recentConversation = before.messages.slice(-10).map((message) => `${message.role === "TUTOR" ? "Tutor" : "Uczeń"}: ${message.content}`).join("\n\n");
    let studentReply = "dalej";
    let studentUsage: Usage = { inputTokens: 0, outputTokens: 0 };
    if (before.phase !== "EXPLAIN" && !/napisz\s+[„"']?dalej/iu.test(prompt)) {
      const generated = await modelStudentReply({
        client,
        model: studentModel,
        persona,
        phase: `CONCEPT_${before.phase}`,
        objective: { ...objective, title: before.concept.name },
        initialLevel: "UNKNOWN",
        learningAttempt: attempt,
        recentConversation,
        allowReferenceKnowledge: false,
      });
      studentReply = generated.reply;
      studentUsage = generated.usage;
    }
    const masteryBefore = await mastery(studentId, objective.id);
    const submissionId = `eval-concept-${conceptSession.id}-${attempt}`;
    await service.answer(studentId, conceptSession.id, studentReply, submissionId);
    const after = await db.conceptSession.findUniqueOrThrow({
      where: { id: conceptSession.id },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 4, include: { assessment: true } },
      },
    });
    const assessment = after.messages.find((message) => message.assessment)?.assessment;
    const tutorMessage = after.messages.find((message) => message.role === "TUTOR");
    trace.push({
      turn: trace.length + 1,
      channel: "CONCEPT",
      phaseBefore: before.phase,
      phaseAfter: after.status,
      objectiveCode: objective.code,
      objectiveTitle: `${objective.title} / ${before.concept.name}`,
      learningStep: before.phase,
      prompt,
      studentReply,
      tutorReply: tutorMessage?.content ?? "",
      masteryBefore,
      masteryAfter: await mastery(studentId, objective.id),
      assessment: assessment?.rating ?? null,
      studentIntent: null,
      evidenceLevel: assessment?.evidenceLevel ?? null,
      masteryDelta: assessment?.masteryDelta ?? 0,
      sourceLocators: locators(assessment?.knowledgeLocators),
      tutorInputTokens: assessment?.inputTokens ?? 0,
      tutorOutputTokens: assessment?.outputTokens ?? 0,
      studentInputTokens: studentUsage.inputTokens,
      studentOutputTokens: studentUsage.outputTokens,
    });
  }
  await service.pause(studentId, conceptSession.id);
  return false;
}

function ruleAudit(trace: TraceRow[], completed: boolean, masteredObjectives: number, objectiveCount: number) {
  const issues: RuleIssue[] = [];
  const previousQuestions: Array<{ turn: number; question: string }> = [];
  let sameObjectiveRun = 0;
  let previousObjective = "";
  for (const row of trace) {
    if (row.channel === "MAIN") {
      const question = lastQuestion(row.tutorReply);
      const repeated = question ? previousQuestions.find((item) => similarity(item.question, question) >= 0.82) : undefined;
      if (repeated) issues.push({ turn: row.turn, severity: "MEDIUM", code: "NEAR_REPEATED_QUESTION", detail: `Podobne do tury ${repeated.turn}: ${question}` });
      if (question) previousQuestions.push({ turn: row.turn, question });
      sameObjectiveRun = row.objectiveCode === previousObjective ? sameObjectiveRun + 1 : 1;
      previousObjective = row.objectiveCode;
      if (sameObjectiveRun === 10) issues.push({ turn: row.turn, severity: "HIGH", code: "OBJECTIVE_STALL", detail: row.objectiveCode });
    }
    const wordCount = row.tutorReply.split(/\s+/gu).filter(Boolean).length;
    if (wordCount > 220) issues.push({ turn: row.turn, severity: "MEDIUM", code: "TOO_LONG", detail: `${wordCount} słów` });
    if (row.phaseBefore === "LEARNING" && row.phaseAfter === "DIAGNOSTIC") issues.push({ turn: row.turn, severity: "HIGH", code: "PHASE_REGRESSION", detail: row.objectiveCode });
    if ((row.studentIntent === "UNCERTAIN" || row.studentIntent === "REQUEST_HELP" || row.evidenceLevel === "NONE") && row.masteryAfter > row.masteryBefore + 0.0001) {
      issues.push({ turn: row.turn, severity: "HIGH", code: "MASTERY_WITHOUT_EVIDENCE", detail: `${row.masteryBefore.toFixed(2)}→${row.masteryAfter.toFixed(2)}; intent=${row.studentIntent}; evidence=${row.evidenceLevel}` });
    }
    if (explicitHelp(row.studentReply) && row.assessment === "CORRECT") issues.push({ turn: row.turn, severity: "HIGH", code: "HELP_RATED_CORRECT", detail: row.studentReply });
  }
  if (!completed) issues.push({ turn: trace.at(-1)?.turn ?? 0, severity: "HIGH", code: "UNIT_NOT_COMPLETED", detail: `mastered=${masteredObjectives}/${objectiveCount}` });
  if (completed && masteredObjectives !== objectiveCount) issues.push({ turn: trace.at(-1)?.turn ?? 0, severity: "HIGH", code: "COMPLETED_WITH_UNMASTERED_OBJECTIVES", detail: `${masteredObjectives}/${objectiveCount}` });
  return issues;
}

async function judgeTranscript(client: OpenAI, model: string, trace: TraceRow[], references: Array<{ code: string; title: string; reference: string }>) {
  const compact = trace.map((row) => ({
    turn: row.turn,
    channel: row.channel,
    phase: `${row.phaseBefore}->${row.phaseAfter}`,
    objective: row.objectiveTitle,
    prompt: row.prompt.slice(0, 1200),
    student: row.studentReply.slice(0, 900),
    tutor: row.tutorReply.slice(0, 1800),
    mastery: `${row.masteryBefore.toFixed(2)}->${row.masteryAfter.toFixed(2)}`,
    evidence: row.evidenceLevel,
    sources: row.sourceLocators,
  }));
  const response = await client.responses.parse({
    model,
    instructions: `Jesteś niezależnym, surowym audytorem polskiego tutora biologii rozszerzonej.
Oceniaj dialog względem przekazanych kontrolowanych materiałów i celów, a nie wyłącznie z pamięci modelu.
Wykrywaj błędy biologiczne, pozorne wyjaśnienia, niewyjaśnione terminy, odpowiedź ujawnioną bezpośrednio przed retrieval question,
nieuzasadnione powtórzenia, brak bezpośredniej odpowiedzi na „nie wiem”, nienaturalne przejścia oraz mastery niezgodne z dowodami.
Nie uznawaj za answer leakage poprawnej odpowiedzi podanej po jawnej prośbie ucznia o pomoc. Kolejne pytanie musi jednak sprawdzać rozumienie, a nie identyczne odtworzenie.
W fazie DIAGNOSTIC neutralne potwierdzenie „zapisuję tę lukę i wrócimy do niej podczas nauki” jest wymaganym zachowaniem produktu, a nie answer leakage.
W fazie LEARNING krótki cykl „wyjaśnienie → pytanie o mechanizm lub zastosowanie” jest wymaganym nauczaniem, a nie answer leakage. Zgłaszaj wyciek tylko wtedy, gdy pytanie wymaga niemal dosłownego powtórzenia odpowiedzi widocznej bezpośrednio nad nim albo tutor zdradza odpowiedź w diagnostyce.
HIGH oznacza błąd naukowy, niebezpieczną halucynację, istotnie błędne mastery albo blokujący błąd przebiegu.
Zwracaj tylko problemy poparte konkretnym fragmentem. Nie wymyślaj braków poza zakresem celów.`,
    input: JSON.stringify({ controlledReferences: references, transcript: compact }),
    text: { format: zodTextFormat(judgeSchema, "evaluation_lab_judge") },
  });
  if (!response.output_parsed) throw new Error("Evaluation judge returned no structured result");
  return {
    result: response.output_parsed,
    usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
  };
}

function usageFor(trace: TraceRow[], judgeUsage: Usage) {
  return trace.reduce((usage, row) => ({
    tutorInputTokens: usage.tutorInputTokens + row.tutorInputTokens,
    tutorOutputTokens: usage.tutorOutputTokens + row.tutorOutputTokens,
    studentInputTokens: usage.studentInputTokens + row.studentInputTokens,
    studentOutputTokens: usage.studentOutputTokens + row.studentOutputTokens,
    judgeInputTokens: judgeUsage.inputTokens,
    judgeOutputTokens: judgeUsage.outputTokens,
  }), { tutorInputTokens: 0, tutorOutputTokens: 0, studentInputTokens: 0, studentOutputTokens: 0, judgeInputTokens: 0, judgeOutputTokens: 0 });
}

function estimatedCost(usage: ReturnType<typeof usageFor>) {
  const inputRate = Number(process.env.EVAL_INPUT_USD_PER_MILLION ?? 0);
  const outputRate = Number(process.env.EVAL_OUTPUT_USD_PER_MILLION ?? 0);
  if (!inputRate && !outputRate) return null;
  const input = usage.tutorInputTokens + usage.studentInputTokens + usage.judgeInputTokens;
  const output = usage.tutorOutputTokens + usage.studentOutputTokens + usage.judgeOutputTokens;
  return Math.round(((input * inputRate + output * outputRate) / 1_000_000) * 10000) / 10000;
}

async function runPersona(params: {
  persona: SyntheticPersona;
  repetition: number;
  runId: string;
  unit: { id: string; courseId: string };
  objectives: Objective[];
  options: EvalOptions;
  client: OpenAI;
  studentModel: string;
  judgeModel: string;
}) {
  const { persona, repetition, runId, unit, objectives, options, client, studentModel, judgeModel } = params;
  const user = await db.user.create({
    data: {
      email: `eval+${runId}-${persona.id}-${repetition}@synthetic.local`,
      passwordHash: await hash(crypto.randomUUID(), 4),
      isSynthetic: true,
      profile: { create: { displayName: `[EVAL] ${persona.name} #${repetition}`, enrollments: { create: { courseId: unit.courseId } } } },
    },
    include: { profile: true },
  });
  if (!user.profile) throw new Error("Synthetic profile missing");
  const studentId = user.profile.id;
  const ai = new OpenAIProvider();
  const tutor = new TutorService(ai);
  const session = await tutor.start(studentId, unit.id, "Symulacja ewaluacyjna: pełny zakres działu genetyki molekularnej.");
  const trace: TraceRow[] = [];
  const learningAttempts = new Map<string, number>();
  const askedConcepts = new Set<string>();
  const incompleteConceptBranches: string[] = [];
  let stoppedReason: string | null = null;
  let guard = 0;

  while (trace.filter((row) => row.channel === "MAIN").length < options.maxTurns && guard < options.maxTurns * 4) {
    guard += 1;
    const before = await db.studySession.findUniqueOrThrow({
      where: { id: session.id },
      include: { messages: { orderBy: { createdAt: "asc" } }, objectiveStates: true },
    });
    if (before.endedAt || before.phase === "COMPLETED") break;
    if (!before.currentObjectiveId) throw new Error("Current objective missing");
    const objective = objectives.find((item) => item.id === before.currentObjectiveId);
    if (!objective) throw new Error(`Objective ${before.currentObjectiveId} outside evaluation unit`);
    const objectiveState = before.objectiveStates.find((item) => item.learningObjectiveId === objective.id);

    if (before.phase === "LEARNING" && objectiveState?.learningStep === "EXPLAIN" && !before.awaitingUnderstandingCheck) {
      const plannedQuestion = persona.plannedConceptQuestions[objective.code as ObjectiveCode];
      if (plannedQuestion && !askedConcepts.has(objective.code)) {
        askedConcepts.add(objective.code);
        const sideBefore = await db.sideChatMessage.count({ where: { studySessionId: session.id } });
        const sideMasteryBefore = await mastery(studentId, objective.id);
        await new SideChatService(ai).ask(studentId, session.id, plannedQuestion, `eval-side-${runId}-${persona.id}-${repetition}-${objective.code}`, objective.id);
        const sideMessages = await db.sideChatMessage.findMany({
          where: { studySessionId: session.id },
          orderBy: { createdAt: "asc" },
          skip: sideBefore,
          include: { linkedConcept: true },
        });
        const sideTutor = sideMessages.findLast((message) => message.role === "TUTOR");
        trace.push({
          turn: trace.length + 1,
          channel: "SIDE",
          phaseBefore: before.phase,
          phaseAfter: before.phase,
          objectiveCode: objective.code,
          objectiveTitle: objective.title,
          learningStep: objectiveState.learningStep,
          prompt: "Boczny czat dostępny podczas wyjaśnienia.",
          studentReply: plannedQuestion,
          tutorReply: sideTutor?.content ?? "",
          masteryBefore: sideMasteryBefore,
          masteryAfter: await mastery(studentId, objective.id),
          assessment: null,
          studentIntent: null,
          evidenceLevel: null,
          masteryDelta: 0,
          sourceLocators: locators(sideTutor?.sourceLocators),
          tutorInputTokens: sideTutor?.inputTokens ?? 0,
          tutorOutputTokens: sideTutor?.outputTokens ?? 0,
          studentInputTokens: 0,
          studentOutputTokens: 0,
        });
        if (sideTutor?.linkedConcept) {
          const completed = await runConceptBranch({
            studentId,
            studySessionId: session.id,
            conceptSlug: sideTutor.linkedConcept.slug,
            objective,
            persona,
            client,
            studentModel,
            trace,
            maxTurns: options.maxConceptTurns,
            ai,
          });
          if (!completed) incompleteConceptBranches.push(sideTutor.linkedConcept.name);
        }
      }
      await tutor.beginPractice(studentId, session.id);
      continue;
    }

    const prompt = before.messages.findLast((message) => message.role === "TUTOR")?.content ?? "";
    const level = levelFor(persona, objective.code);
    const attempt = (learningAttempts.get(objective.code) ?? 0) + 1;
    if (before.phase !== "DIAGNOSTIC" && attempt > options.maxObjectiveTurns) {
      stoppedReason = `OBJECTIVE_ATTEMPT_LIMIT:${objective.code}:${options.maxObjectiveTurns}`;
      break;
    }
    let studentReply: string;
    let studentUsage: Usage = { inputTokens: 0, outputTokens: 0 };
    const deterministic = before.phase === "DIAGNOSTIC"
      ? deterministicDiagnostic(persona, objective.code as ObjectiveCode, level)
      : undefined;
    if (deterministic) {
      studentReply = deterministic;
    } else if (/napisz\s+[„"']?dalej/iu.test(prompt) && before.phase !== "DIAGNOSTIC") {
      studentReply = "dalej";
    } else {
      const generated = await modelStudentReply({
        client,
        model: studentModel,
        persona,
        phase: before.phase,
        objective,
        initialLevel: level,
        learningAttempt: attempt,
        recentConversation: before.messages.slice(-12).map((message) => `${message.role === "TUTOR" ? "Tutor" : "Uczeń"}: ${message.content}`).join("\n\n"),
        allowReferenceKnowledge: before.phase === "DIAGNOSTIC" && level === "MASTERED",
      });
      studentReply = generated.reply;
      studentUsage = generated.usage;
    }
    if (before.phase !== "DIAGNOSTIC") learningAttempts.set(objective.code, attempt);

    const masteryBefore = await mastery(studentId, objective.id);
    const submissionId = `eval-main-${runId}-${persona.id}-${repetition}-${trace.length + 1}`;
    await tutor.answer(studentId, session.id, studentReply, submissionId);
    const after = await db.studySession.findUniqueOrThrow({
      where: { id: session.id },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const answer = await assessmentFor(submissionId);
    const assessment = answer?.assessment;
    trace.push({
      turn: trace.length + 1,
      channel: "MAIN",
      phaseBefore: before.phase,
      phaseAfter: after.phase,
      objectiveCode: objective.code,
      objectiveTitle: objective.title,
      learningStep: objectiveState?.learningStep ?? null,
      prompt,
      studentReply,
      tutorReply: after.messages[0]?.content ?? "",
      masteryBefore,
      masteryAfter: await mastery(studentId, objective.id),
      assessment: assessment?.rating ?? null,
      studentIntent: assessment?.studentIntent ?? null,
      evidenceLevel: assessment?.evidenceLevel ?? null,
      masteryDelta: assessment?.masteryDelta ?? 0,
      sourceLocators: locators(assessment?.knowledgeLocators),
      tutorInputTokens: assessment?.inputTokens ?? 0,
      tutorOutputTokens: assessment?.outputTokens ?? 0,
      studentInputTokens: studentUsage.inputTokens,
      studentOutputTokens: studentUsage.outputTokens,
    });
  }

  const final = await db.studySession.findUniqueOrThrow({
    where: { id: session.id },
    include: { objectiveStates: { include: { learningObjective: true } } },
  });
  const masteries = await db.studentMastery.findMany({ where: { studentId } });
  const masteryMap = new Map(masteries.map((item) => [item.learningObjectiveId, item]));
  const objectiveResults = final.objectiveStates.map((state) => ({
    code: state.learningObjective.code,
    title: state.learningObjective.title,
    initialLevel: levelFor(persona, state.learningObjective.code),
    status: state.status,
    mastery: masteryMap.get(state.learningObjectiveId)?.mastery ?? 0,
    confidence: masteryMap.get(state.learningObjectiveId)?.confidence ?? 0,
    attempts: masteryMap.get(state.learningObjectiveId)?.attempts ?? 0,
  }));
  const completed = final.phase === "COMPLETED" && Boolean(final.endedAt);
  const masteredObjectives = objectiveResults.filter((item) => item.status === "MASTERED").length;
  const ruleIssues = ruleAudit(trace, completed, masteredObjectives, objectiveResults.length);
  if (stoppedReason) ruleIssues.push({ turn: trace.at(-1)?.turn ?? 0, severity: "HIGH", code: "OBJECTIVE_ATTEMPT_LIMIT", detail: stoppedReason });
  for (const result of objectiveResults) {
    if (result.mastery >= 0.82 && result.status !== "MASTERED") {
      ruleIssues.push({
        turn: trace.at(-1)?.turn ?? 0,
        severity: "HIGH",
        code: "MASTERY_STATUS_MISMATCH",
        detail: `${result.code}: mastery=${result.mastery.toFixed(2)}, status=${result.status}`,
      });
    }
    if (result.status === "MASTERED" && result.mastery < 0.82) {
      ruleIssues.push({
        turn: trace.at(-1)?.turn ?? 0,
        severity: "HIGH",
        code: "STATUS_MASTERY_MISMATCH",
        detail: `${result.code}: status=MASTERED, mastery=${result.mastery.toFixed(2)}`,
      });
    }
  }
  for (const concept of incompleteConceptBranches) ruleIssues.push({ turn: 0, severity: "MEDIUM", code: "CONCEPT_BRANCH_NOT_COMPLETED", detail: concept });

  const references = await Promise.all(objectives.map(async (objective) => {
    const excerpts = await new KnowledgeService().retrieveForObjective(objective.id, objective.title, 2);
    return {
      code: objective.code,
      title: objective.title,
      reference: [objective.description, objective.microExplanation, objective.workedExample, ...excerpts.map((item) => `[${item.locator}] ${item.content.slice(0, 1600)}`)].join("\n"),
    };
  }));
  const judged = options.judge
    ? await judgeTranscript(client, judgeModel, trace, references)
    : { result: null, usage: { inputTokens: 0, outputTokens: 0 } };
  const usage = usageFor(trace, judged.usage);
  const highIssues = ruleIssues.filter((issue) => issue.severity === "HIGH").length
    + (judged.result?.issues.filter((issue) => issue.severity === "HIGH").length ?? 0);
  return {
    persona: { id: persona.id, name: persona.name },
    repetition,
    syntheticUserId: user.id,
    sessionId: session.id,
    finalPhase: final.phase,
    completed,
    stoppedReason,
    passed: completed && masteredObjectives === objectiveResults.length && highIssues === 0 && judged.result?.verdict !== "FAIL",
    mainTurns: trace.filter((row) => row.channel === "MAIN").length,
    sideTurns: trace.filter((row) => row.channel === "SIDE").length,
    conceptTurns: trace.filter((row) => row.channel === "CONCEPT").length,
    masteredObjectives,
    objectiveCount: objectiveResults.length,
    objectiveResults,
    ruleIssues,
    judge: judged.result,
    usage,
    estimatedCostUsd: estimatedCost(usage),
    trace,
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function htmlReport(report: {
  runId: string;
  createdAt: string;
  label: string;
  models: { tutor: string; student: string; judge: string };
  summary: { runs: number; passed: number; completed: number; highIssues: number };
  results: Array<Awaited<ReturnType<typeof runPersona>>>;
}) {
  const cards = report.results.map((result) => {
    const allIssues = [
      ...result.ruleIssues.map((issue) => ({ ...issue, category: issue.code, explanation: issue.detail })),
      ...(result.judge?.issues ?? []),
    ];
    const transcript = result.trace.map((row) => `<article class="turn"><h4>#${row.turn} · ${row.channel} · ${escapeHtml(row.objectiveTitle)}</h4><p><b>Pytanie:</b> ${escapeHtml(row.prompt)}</p><p><b>Uczeń:</b> ${escapeHtml(row.studentReply)}</p><p><b>Tutor:</b> ${escapeHtml(row.tutorReply)}</p><small>mastery ${row.masteryBefore.toFixed(2)}→${row.masteryAfter.toFixed(2)} · ${escapeHtml(row.assessment)} · ${escapeHtml(row.evidenceLevel)}</small></article>`).join("");
    return `<section class="result ${result.passed ? "pass" : "fail"}"><h2>${escapeHtml(result.persona.name)} #${result.repetition}</h2><p><b>${result.passed ? "PASS" : "NEEDS WORK"}</b> · completed=${result.completed} · mastery=${result.masteredObjectives}/${result.objectiveCount} · main=${result.mainTurns} · side=${result.sideTurns} · concepts=${result.conceptTurns}</p><p>Tokeny: tutor ${result.usage.tutorInputTokens}/${result.usage.tutorOutputTokens}, uczeń ${result.usage.studentInputTokens}/${result.usage.studentOutputTokens}, judge ${result.usage.judgeInputTokens}/${result.usage.judgeOutputTokens}${result.estimatedCostUsd === null ? "" : ` · szacunek $${result.estimatedCostUsd}`}</p><h3>Problemy (${allIssues.length})</h3>${allIssues.length ? `<ul>${allIssues.map((issue) => `<li class="severity-${escapeHtml(issue.severity)}"><b>${escapeHtml(issue.severity)} ${escapeHtml(issue.category)}</b>: ${escapeHtml(issue.explanation)}</li>`).join("")}</ul>` : "<p>Brak wykrytych problemów.</p>"}<details><summary>Wyniki celów</summary><table><tr><th>Cel</th><th>Start</th><th>Status</th><th>Mastery</th></tr>${result.objectiveResults.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${item.initialLevel}</td><td>${item.status}</td><td>${Math.round(item.mastery * 100)}%</td></tr>`).join("")}</table></details><details><summary>Pełny przebieg</summary>${transcript}</details></section>`;
  }).join("");
  return `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Evaluation Lab ${escapeHtml(report.runId)}</title><style>body{font:15px/1.5 system-ui;max-width:1180px;margin:32px auto;padding:0 18px;color:#17342c;background:#f5f7f2}section.result{background:white;border:1px solid #dce5df;border-left:7px solid #b23a48;border-radius:16px;padding:22px;margin:20px 0}.result.pass{border-left-color:#168260}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric{background:white;border-radius:12px;padding:14px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #ddd}.turn{white-space:pre-wrap;border-top:1px solid #ddd;padding:12px 0}.severity-HIGH{color:#9f2734}.severity-MEDIUM{color:#875b00}details{margin-top:14px}summary{cursor:pointer;font-weight:700}</style><h1>Evaluation Lab</h1><p>${escapeHtml(report.createdAt)} · ${escapeHtml(report.label)} · modele: tutor=${escapeHtml(report.models.tutor)}, student=${escapeHtml(report.models.student)}, judge=${escapeHtml(report.models.judge)}</p><div class="summary"><div class="metric"><b>Przebiegi</b><br>${report.summary.runs}</div><div class="metric"><b>Zaliczone</b><br>${report.summary.passed}</div><div class="metric"><b>Ukończone</b><br>${report.summary.completed}</div><div class="metric"><b>HIGH issues</b><br>${report.summary.highIssues}</div></div>${cards}</html>`;
}

export async function runEvaluationLab(options: EvalOptions) {
  if (process.env.EVALS_ALLOW_DATABASE_WRITES !== "true") throw new Error("Set EVALS_ALLOW_DATABASE_WRITES=true");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
  const selected = options.personaIds.map((id) => personas.find((persona) => persona.id === id) ?? (() => { throw new Error(`Unknown persona: ${id}`); })());
  const unit = await db.unit.findFirstOrThrow({
    where: { title: "Genetyka molekularna", course: { active: true } },
    include: { topics: { include: { objectives: { where: { active: true } } } } },
  });
  const objectives = unit.topics.flatMap((topic) => topic.objectives).sort((left, right) => objectiveCodes.indexOf(left.code as ObjectiveCode) - objectiveCodes.indexOf(right.code as ObjectiveCode));
  const missing = objectiveCodes.filter((code) => !objectives.some((objective) => objective.code === code));
  if (missing.length) throw new Error(`Missing evaluation objectives: ${missing.join(", ")}`);

  const tutorModel = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const studentModel = process.env.EVAL_STUDENT_MODEL ?? tutorModel;
  const judgeModel = process.env.EVAL_JUDGE_MODEL ?? tutorModel;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const runId = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${options.label}`;
  const results = [];
  for (const persona of selected) {
    for (let repetition = 1; repetition <= options.repetitions; repetition += 1) {
      console.log(`[eval] start persona=${persona.id} repetition=${repetition}`);
      const result = await runPersona({ persona, repetition, runId, unit, objectives, options, client, studentModel, judgeModel });
      results.push(result);
      console.log(`[eval] done persona=${persona.id} pass=${result.passed} completed=${result.completed} mastery=${result.masteredObjectives}/${result.objectiveCount} turns=${result.mainTurns}`);
    }
  }
  const report = {
    runId,
    label: options.label,
    createdAt: new Date().toISOString(),
    options,
    models: { tutor: tutorModel, student: studentModel, judge: judgeModel, rolesUseDistinctModels: new Set([tutorModel, studentModel, judgeModel]).size === 3 },
    unit: { id: unit.id, title: unit.title },
    summary: {
      runs: results.length,
      passed: results.filter((result) => result.passed).length,
      completed: results.filter((result) => result.completed).length,
      highIssues: results.reduce((count, result) => count + result.ruleIssues.filter((issue) => issue.severity === "HIGH").length + (result.judge?.issues.filter((issue) => issue.severity === "HIGH").length ?? 0), 0),
      inputTokens: results.reduce((count, result) => count + result.usage.tutorInputTokens + result.usage.studentInputTokens + result.usage.judgeInputTokens, 0),
      outputTokens: results.reduce((count, result) => count + result.usage.tutorOutputTokens + result.usage.studentOutputTokens + result.usage.judgeOutputTokens, 0),
    },
    results,
  };
  const outputDir = path.join(process.cwd(), "eval-results");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  const htmlPath = path.join(outputDir, `${runId}.html`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(htmlPath, htmlReport(report));
  return { ...report, paths: { json: jsonPath, html: htmlPath } };
}

export function optionsFromArgs(args: string[]): EvalOptions {
  const value = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const personaIds = (value("personas") ?? personas.map((persona) => persona.id).join(",")).split(",").filter(Boolean);
  return {
    personaIds,
    repetitions: Number(value("repetitions") ?? 1),
    maxTurns: Number(value("max-turns") ?? process.env.EVAL_MAX_TURNS ?? 180),
    maxObjectiveTurns: Number(value("max-objective-turns") ?? process.env.EVAL_MAX_OBJECTIVE_TURNS ?? 8),
    maxConceptTurns: Number(value("max-concept-turns") ?? process.env.EVAL_MAX_CONCEPT_TURNS ?? 12),
    judge: !args.includes("--skip-judge"),
    label: value("label") ?? "synthetic-class",
  };
}
