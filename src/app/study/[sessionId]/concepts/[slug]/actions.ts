"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ConceptTutorService } from "@/server/services/concept-tutor-service";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { SideChatService } from "@/server/services/side-chat-service";
import { visibleConceptsFor } from "@/server/services/concept-visibility";

export async function submitSideQuestion(sessionId: string, slug: string, form: FormData) {
  const student = await requireStudent();
  const question = String(form.get("sideQuestion") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!question) return;
  const studySession = await db.studySession.findFirstOrThrow({
    where: { id: sessionId, studentId: student.id, endedAt: null, pausedAt: null },
    include: { unit: { include: { course: true } } },
  });
  const concept = await db.concept.findFirstOrThrow({
    where: {
      slug,
      active: true,
      curriculumVersionId: studySession.unit.course.curriculumVersionId,
      ...visibleConceptsFor(student.id),
      objectives: { some: { learningObjective: { topic: { unitId: studySession.unitId } } } },
    },
    include: { objectives: { orderBy: { importance: "desc" }, take: 1 } },
  });
  await new SideChatService(new OpenAIProvider()).ask(student.id, sessionId, question, submissionId || undefined, concept.objectives[0]?.learningObjectiveId);
  revalidatePath(`/study/${sessionId}/concepts/${slug}`);
  revalidatePath(`/study/${sessionId}`);
}

export async function startConceptSession(sessionId: string, slug: string, familiarity: "NOT_FAMILIAR" | "SOMEWHAT_FAMILIAR" | "FAMILIAR") {
  const student = await requireStudent();
  const session = await new ConceptTutorService(new OpenAIProvider()).start(student.id, sessionId, slug, familiarity);
  redirect(`/concept-sessions/${session.id}`);
}

export async function resetConceptKnowledge(sessionId: string, slug: string) {
  const student = await requireStudent();
  await new ConceptTutorService(new OpenAIProvider()).reset(student.id, sessionId, slug);
  revalidatePath(`/study/${sessionId}`);
  revalidatePath(`/study/${sessionId}/concepts/${slug}`);
  redirect(`/study/${sessionId}/concepts/${slug}?reset=1`);
}
