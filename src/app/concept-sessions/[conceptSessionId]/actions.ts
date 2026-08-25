"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/session";
import { ConceptTutorService } from "@/server/services/concept-tutor-service";
import { ConceptIntentService } from "@/server/services/concept-intent-service";
import { ConceptDiscoveryService } from "@/server/services/concept-discovery-service";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { db } from "@/server/db/client";
import { AIRateLimitService } from "@/server/services/ai-rate-limit-service";
import { SideChatService } from "@/server/services/side-chat-service";
import { LearningEventService } from "@/server/services/learning-event-service";

export async function submitSideQuestion(conceptSessionId: string, form: FormData) {
  const student = await requireStudent();
  const question = String(form.get("sideQuestion") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!question) return;
  const conceptSession = await db.conceptSession.findFirstOrThrow({
    where: { id: conceptSessionId, studentId: student.id },
    include: { concept: { include: { objectives: { orderBy: { importance: "desc" }, take: 1 } } } },
  });
  await new SideChatService(new OpenAIProvider()).ask(
    student.id,
    conceptSession.parentStudySessionId,
    question,
    submissionId || undefined,
    conceptSession.concept.objectives[0]?.learningObjectiveId,
  );
  revalidatePath(`/concept-sessions/${conceptSessionId}`);
  revalidatePath(`/study/${conceptSession.parentStudySessionId}`);
}

export async function submitConceptAnswer(conceptSessionId: string, form: FormData) {
  const student = await requireStudent();
  const answer = String(form.get("answer") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!answer) return;
  const rateLimit = new AIRateLimitService();
  if (!(await rateLimit.consume(student.id)).allowed) {
    await rateLimit.notifyConceptSession(student.id, conceptSessionId);
    revalidatePath(`/concept-sessions/${conceptSessionId}`);
    return;
  }
  const ai = new OpenAIProvider();
  const current = await db.conceptSession.findFirstOrThrow({
    where: { id: conceptSessionId, studentId: student.id, status: "ACTIVE" },
    include: {
      concept: { include: { objectives: { orderBy: { importance: "desc" }, take: 1 } } },
      messages: { where: { role: "TUTOR" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const latestTutorAt = current.messages[0]?.createdAt;
  await new LearningEventService().record({
    studentId: student.id,
    studySessionId: current.parentStudySessionId,
    learningObjectiveId: current.concept.objectives[0]?.learningObjectiveId,
    eventType: "ANSWER_SUBMITTED",
    metadata: {
      surface: "CONCEPT_SESSION",
      characterCount: answer.length,
      responseTimeMs: latestTutorAt ? Math.max(0, Date.now() - latestTutorAt.getTime()) : 0,
    },
    deduplicationKey: submissionId ? `concept-answer:${submissionId}` : undefined,
  });
  const requested = await new ConceptDiscoveryService(ai).discover(
    student.id,
    current.parentStudySessionId,
    answer,
    current.concept.objectives[0]?.learningObjectiveId,
  );
  const discovered = requested ?? await new ConceptIntentService().resolve(student.id, current.parentStudySessionId, answer);
  if (discovered && discovered.id !== current.conceptId) {
    const branch = await new ConceptTutorService(ai).start(student.id, current.parentStudySessionId, discovered.slug, "NOT_FAMILIAR", answer, current.id);
    revalidatePath(`/study/${current.parentStudySessionId}`);
    revalidatePath(`/concept-sessions/${conceptSessionId}`);
    redirect(`/concept-sessions/${branch.id}`);
  }
  await new ConceptTutorService(ai).answer(student.id, conceptSessionId, answer, submissionId || undefined);
  revalidatePath(`/concept-sessions/${conceptSessionId}`);
}

export async function pauseConceptSession(conceptSessionId: string) {
  const student = await requireStudent();
  const result = await new ConceptTutorService(new OpenAIProvider()).pause(student.id, conceptSessionId);
  revalidatePath(`/study/${result.parentStudySessionId}`);
  if (result.parentConceptSessionId) revalidatePath(`/concept-sessions/${result.parentConceptSessionId}`);
  redirect(result.parentConceptSessionId
    ? `/concept-sessions/${result.parentConceptSessionId}`
    : `/study/${result.parentStudySessionId}${result.returnToMessageId ? `#message-${result.returnToMessageId}` : ""}`);
}
