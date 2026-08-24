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

const replySchema = z.object({ reply: z.string().min(1).max(600) });

const personas = [
  {
    id: "novice",
    name: "Początkujący",
    instruction: "Nie znasz działu. Często odpowiadasz 'nie wiem', pytasz o każde nieznane słowo i potrzebujesz prostych przykładów.",
  },
  {
    id: "definition_only",
    name: "Znający definicje",
    instruction: "Pamiętasz część terminów, ale mylisz definicję z mechanizmem. Odpowiadasz wiarygodnie, czasem z typowym błędem pojęciowym.",
  },
  {
    id: "terse",
    name: "Lakoniczny i niecierpliwy",
    instruction: "Piszesz krótko: 'tak', 'dalej', 'nie kumam', czasem prosisz tutora, żeby sam podał odpowiedź.",
  },
  {
    id: "advanced",
    name: "Zaawansowany",
    instruction: "Dobrze znasz materiał, wyjaśniasz mechanizmy i potrafisz zastosować wiedzę w nowych sytuacjach, ale nie udajesz wszechwiedzy.",
  },
] as const;

type TraceRow = {
  turn: number;
  phase: string;
  objectiveId: string | null;
  studentReply: string;
  tutorReply: string;
};

function normalize(text: string) {
  return text.toLocaleLowerCase("pl-PL").replace(/\s+/gu, " ").replace(/[^\p{L}\p{N}?' ]/gu, "").trim();
}

function lastQuestion(text: string) {
  return text.split(/\n+/gu).map((part) => part.trim()).filter(Boolean).findLast((part) => part.includes("?")) ?? "";
}

function audit(trace: TraceRow[], messages: Array<{ content: string; knowledgeAssetId: string | null }>) {
  const issues: Array<{ code: string; detail: string }> = [];
  const questions = new Map<string, number>();
  for (const row of trace) {
    const question = normalize(lastQuestion(row.tutorReply));
    if (question) {
      const previous = questions.get(question);
      if (previous !== undefined) issues.push({ code: "REPEATED_QUESTION", detail: `Tury ${previous} i ${row.turn}: ${lastQuestion(row.tutorReply)}` });
      else questions.set(question, row.turn);
    }
    const paragraphs = row.tutorReply.split(/\n\s*\n/gu).map(normalize).filter((part) => part.length > 40);
    if (new Set(paragraphs).size !== paragraphs.length) issues.push({ code: "DUPLICATED_PARAGRAPH", detail: `Tura ${row.turn}` });
  }
  for (let index = 1; index < trace.length; index += 1) {
    if (trace[index - 1].phase === "LEARNING" && trace[index].phase === "DIAGNOSTIC") {
      issues.push({ code: "PHASE_REGRESSION", detail: `Tura ${trace[index].turn}` });
    }
  }
  const assets = messages.map((message) => message.knowledgeAssetId).filter((id): id is string => Boolean(id));
  const repeatedAssets = assets.filter((id, index) => assets.indexOf(id) !== index);
  if (repeatedAssets.length) issues.push({ code: "REPEATED_VISUAL", detail: `${new Set(repeatedAssets).size} zasobów pokazano wielokrotnie` });
  return issues;
}

async function studentReply(client: OpenAI, persona: typeof personas[number], transcript: string) {
  const response = await client.responses.parse({
    model: process.env.EVAL_STUDENT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
    instructions: `Symulujesz polskiego ucznia klasy IV liceum podczas prawdziwej nauki biologii. ${persona.instruction} Odpowiadaj wyłącznie jako uczeń, naturalnie i krótko. Nie oceniaj tutora i nie wychodź z roli.`,
    input: transcript,
    text: { format: zodTextFormat(replySchema, "synthetic_student_reply") },
  });
  if (!response.output_parsed) throw new Error("Synthetic student returned no reply");
  return response.output_parsed.reply;
}

async function runPersona(persona: typeof personas[number], courseId: string, unitId: string, runId: string) {
  const user = await db.user.create({
    data: {
      email: `eval+${runId}-${persona.id}@synthetic.local`,
      passwordHash: await hash(crypto.randomUUID(), 4),
      isSynthetic: true,
      profile: { create: { displayName: `[EVAL] ${persona.name}`, enrollments: { create: { courseId } } } },
    },
    include: { profile: true },
  });
  if (!user.profile) throw new Error("Synthetic profile was not created");

  const tutor = new TutorService(new OpenAIProvider());
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const session = await tutor.start(user.profile.id, unitId, "Symulacja ewaluacyjna; pełny zakres działu.");
  const trace: TraceRow[] = [];
  const maxTurns = Number(process.env.EVAL_MAX_TURNS ?? 16);

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const state = await db.studySession.findUniqueOrThrow({
      where: { id: session.id },
      include: { messages: { orderBy: { createdAt: "asc" } }, objectiveStates: true },
    });
    if (state.endedAt || state.phase === "COMPLETED") break;
    const currentState = state.objectiveStates.find((item) => item.learningObjectiveId === state.currentObjectiveId);
    if (state.phase === "LEARNING" && currentState?.learningStep === "EXPLAIN" && !state.awaitingUnderstandingCheck) {
      await tutor.beginPractice(user.profile.id, session.id);
      continue;
    }
    const recent = state.messages.slice(-10).map((message) => `${message.role === "TUTOR" ? "Tutor" : "Uczeń"}: ${message.content}`).join("\n\n");
    const reply = await studentReply(client, persona, recent);
    await tutor.answer(user.profile.id, session.id, reply, `eval-${runId}-${persona.id}-${turn}`);
    const after = await db.studySession.findUniqueOrThrow({
      where: { id: session.id },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    trace.push({
      turn,
      phase: after.phase,
      objectiveId: after.currentObjectiveId,
      studentReply: reply,
      tutorReply: after.messages[0]?.content ?? "",
    });
  }

  const final = await db.studySession.findUniqueOrThrow({
    where: { id: session.id },
    include: { messages: { orderBy: { createdAt: "asc" } }, objectiveStates: true },
  });
  return {
    persona: { id: persona.id, name: persona.name },
    syntheticUserId: user.id,
    sessionId: session.id,
    finalPhase: final.phase,
    turns: trace.length,
    masteredObjectives: final.objectiveStates.filter((state) => state.status === "MASTERED").length,
    issues: audit(trace, final.messages),
    trace,
  };
}

function htmlReport(report: { runId: string; createdAt: string; results: Awaited<ReturnType<typeof runPersona>>[] }) {
  const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Eval ${report.runId}</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:0 20px}section{border:1px solid #ddd;border-radius:12px;padding:20px;margin:20px 0}.bad{color:#a21}.ok{color:#176b3a}details{margin:8px 0;white-space:pre-wrap}</style><h1>Wirtualna klasa — ${report.runId}</h1><p>${report.createdAt}</p>${report.results.map((result) => `<section><h2>${escapeHtml(result.persona.name)}</h2><p>Faza: ${result.finalPhase}; tury: ${result.turns}; opanowane cele: ${result.masteredObjectives}</p><h3>Problemy</h3>${result.issues.length ? `<ul class="bad">${result.issues.map((issue) => `<li><b>${issue.code}</b>: ${escapeHtml(issue.detail)}</li>`).join("")}</ul>` : '<p class="ok">Brak problemów wykrytych regułami.</p>'}<details><summary>Przebieg</summary>${escapeHtml(result.trace.map((row) => `UCZEŃ: ${row.studentReply}\nTUTOR: ${row.tutorReply}`).join("\n\n"))}</details></section>`).join("")}</html>`;
}

async function main() {
  if (process.env.EVALS_ALLOW_DATABASE_WRITES !== "true") throw new Error("Set EVALS_ALLOW_DATABASE_WRITES=true to run synthetic students");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
  const unit = await db.unit.findFirstOrThrow({ where: { order: 1, course: { active: true } }, orderBy: { id: "asc" } });
  const runId = new Date().toISOString().replace(/[:.]/gu, "-");
  const results = [];
  for (const persona of personas) results.push(await runPersona(persona, unit.courseId, unit.id, runId));
  const report = { runId, createdAt: new Date().toISOString(), unit: { id: unit.id, title: unit.title }, results };
  const outputDir = path.join(process.cwd(), "eval-results");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${runId}.json`), JSON.stringify(report, null, 2));
  await writeFile(path.join(outputDir, `${runId}.html`), htmlReport(report));
  console.log(`Eval complete: eval-results/${runId}.html`);
}

main().finally(() => db.$disconnect());
