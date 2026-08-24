"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/session";
import { TutorService } from "@/server/services/tutor-service";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { db } from "@/server/db/client";
import { ConceptIntentService } from "@/server/services/concept-intent-service";
import { ConceptTutorService } from "@/server/services/concept-tutor-service";
import { ConceptDiscoveryService } from "@/server/services/concept-discovery-service";
import { uniqueConceptIds } from "@/server/services/session-lifecycle-policy";
import { AIRateLimitService } from "@/server/services/ai-rate-limit-service";
import { SideChatService } from "@/server/services/side-chat-service";
import { conceptMentions } from "@/server/services/concept-mentions";

export async function submitSideQuestion(sessionId: string, form: FormData) {
  const student = await requireStudent();
  const question = String(form.get("sideQuestion") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!question) return;
  await new SideChatService(new OpenAIProvider()).ask(student.id, sessionId, question, submissionId || undefined);
  revalidatePath(`/study/${sessionId}`);
}

export async function openConceptMention(sessionId: string, messageId: string, term: string) {
  const student = await requireStudent();
  const message = await db.tutorMessage.findFirstOrThrow({
    where: { id: messageId, sessionId, role: "TUTOR", session: { studentId: student.id, endedAt: null, pausedAt: null } },
  });
  const mention = conceptMentions(message.conceptMentions).find((item) => item.term.toLocaleLowerCase("pl-PL") === term.trim().toLocaleLowerCase("pl-PL"));
  if (!mention || !message.content.toLocaleLowerCase("pl-PL").includes(mention.term.toLocaleLowerCase("pl-PL"))) throw new Error("Nieprawidłowa wzmianka o pojęciu.");

  const query = `czym jest ${mention.term}`;
  const existing = await new ConceptIntentService().resolve(student.id, sessionId, query);
  if (existing) redirect(`/study/${sessionId}/concepts/${existing.slug}`);
  const rateLimit = new AIRateLimitService();
  if (!(await rateLimit.consume(student.id)).allowed) {
    await rateLimit.notifyStudySession(student.id, sessionId);
    redirect(`/study/${sessionId}#message-${messageId}`);
  }
  const concept = await new ConceptDiscoveryService(new OpenAIProvider()).discover(student.id, sessionId, query, message.learningObjectiveId ?? undefined);
  if (!concept) redirect(`/study/${sessionId}?conceptUnavailable=1#message-${messageId}`);
  revalidatePath(`/study/${sessionId}`);
  redirect(`/study/${sessionId}/concepts/${concept.slug}`);
}

export async function submitAnswer(sessionId: string, form: FormData) {
  const student = await requireStudent();
  const answer = String(form.get("answer") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!answer) return;
  const rateLimit = new AIRateLimitService();
  if (!(await rateLimit.consume(student.id)).allowed) {
    await rateLimit.notifyStudySession(student.id, sessionId);
    revalidatePath(`/study/${sessionId}`);
    return;
  }
  const ai = new OpenAIProvider();
  const requestedConcept = await new ConceptDiscoveryService(ai).discover(student.id, sessionId, answer);
  const concept = requestedConcept ?? await new ConceptIntentService().resolve(student.id, sessionId, answer);
  if (concept) {
    const conceptSession = await new ConceptTutorService(ai).start(student.id, sessionId, concept.slug, "NOT_FAMILIAR", answer);
    revalidatePath(`/study/${sessionId}`);
    redirect(`/concept-sessions/${conceptSession.id}`);
  }
  await new TutorService(ai).answer(student.id, sessionId, answer, submissionId || undefined);
  revalidatePath(`/study/${sessionId}`);
}

export async function beginPractice(sessionId: string) {
  const student = await requireStudent();
  await new TutorService(new OpenAIProvider()).beginPractice(student.id, sessionId);
  revalidatePath(`/study/${sessionId}`);
}

export async function skipDiagnostic(sessionId: string) {
  const student = await requireStudent();
  await new TutorService(new OpenAIProvider()).skipRemainingDiagnostic(student.id, sessionId);
  revalidatePath(`/study/${sessionId}`);
}

export async function pauseStudySession(sessionId: string) {
  const student = await requireStudent();
  await db.$transaction([
    db.studySession.update({
      where: { id: sessionId, studentId: student.id, endedAt: null, pausedAt: null },
      data: { pausedAt: new Date() },
    }),
    db.conceptSession.updateMany({
      where: { parentStudySessionId: sessionId, studentId: student.id, status: "ACTIVE" },
      data: { status: "PAUSED" },
    }),
  ]);
  redirect("/dashboard");
}

export async function resetUnitProgress(sessionId: string) {
  const student = await requireStudent();
  const previous = await db.studySession.findFirstOrThrow({
    where: { id: sessionId, studentId: student.id },
    include: { teacherScopeNote: true },
  });
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: previous.unitId },
    include: { topics: { include: { objectives: { where: { active: true }, select: { id: true } } } } },
  });
  const objectiveIds = unit.topics.flatMap((topic) => topic.objectives.map((objective) => objective.id));
  const conceptLinks = await db.conceptObjective.findMany({
    where: { learningObjectiveId: { in: objectiveIds } },
    select: { conceptId: true },
  });
  const conceptIds = uniqueConceptIds(conceptLinks);
  await db.$transaction([
    db.studySession.update({ where: { id: previous.id }, data: { phase: "COMPLETED", pausedAt: null, endedAt: new Date() } }),
    db.studentMastery.updateMany({
      where: { studentId: student.id, learningObjectiveId: { in: objectiveIds } },
      data: { mastery: 0, confidence: 0, attempts: 0, lastPracticedAt: null },
    }),
    db.reviewSchedule.deleteMany({
      where: { studentId: student.id, learningObjectiveId: { in: objectiveIds } },
    }),
    db.studentConceptState.deleteMany({
      where: { studentId: student.id, conceptId: { in: conceptIds } },
    }),
    db.conceptSession.updateMany({
      where: { parentStudySessionId: previous.id, studentId: student.id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "RESET", endedAt: new Date() },
    }),
  ]);
  const session = await new TutorService(new OpenAIProvider()).start(
    student.id,
    previous.unitId,
    previous.teacherScopeNote?.content,
  );
  redirect(`/study/${session.id}`);
}
