"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/session";
import { ConceptTutorService } from "@/server/services/concept-tutor-service";
import { ConceptIntentService } from "@/server/services/concept-intent-service";
import { ConceptDiscoveryService } from "@/server/services/concept-discovery-service";
import { db } from "@/server/db/client";

export async function submitConceptAnswer(conceptSessionId: string, form: FormData) {
  const student = await requireStudent();
  const answer = String(form.get("answer") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!answer) return;
  const current = await db.conceptSession.findFirstOrThrow({
    where: { id: conceptSessionId, studentId: student.id, status: "ACTIVE" },
    include: { concept: { include: { objectives: { orderBy: { importance: "desc" }, take: 1 } } } },
  });
  const requested = await new ConceptDiscoveryService().discover(
    student.id,
    current.parentStudySessionId,
    answer,
    current.concept.objectives[0]?.learningObjectiveId,
  );
  const discovered = requested ?? await new ConceptIntentService().resolve(student.id, current.parentStudySessionId, answer);
  if (discovered && discovered.id !== current.conceptId) {
    const branch = await new ConceptTutorService().start(student.id, current.parentStudySessionId, discovered.slug, "NOT_FAMILIAR", answer, current.id);
    revalidatePath(`/study/${current.parentStudySessionId}`);
    revalidatePath(`/concept-sessions/${conceptSessionId}`);
    redirect(`/concept-sessions/${branch.id}`);
  }
  await new ConceptTutorService().answer(student.id, conceptSessionId, answer, submissionId || undefined);
  revalidatePath(`/concept-sessions/${conceptSessionId}`);
}

export async function pauseConceptSession(conceptSessionId: string) {
  const student = await requireStudent();
  const result = await new ConceptTutorService().pause(student.id, conceptSessionId);
  revalidatePath(`/study/${result.parentStudySessionId}`);
  if (result.parentConceptSessionId) revalidatePath(`/concept-sessions/${result.parentConceptSessionId}`);
  redirect(result.parentConceptSessionId
    ? `/concept-sessions/${result.parentConceptSessionId}`
    : `/study/${result.parentStudySessionId}${result.returnToMessageId ? `#message-${result.returnToMessageId}` : ""}`);
}
