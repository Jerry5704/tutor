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
    include: { concept: { include: { objectives: { orderBy: { importance: "desc" }, take: 1 } } } },
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
