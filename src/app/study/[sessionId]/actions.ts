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

export async function submitAnswer(sessionId: string, form: FormData) {
  const student = await requireStudent();
  const answer = String(form.get("answer") ?? "").trim();
  const submissionId = String(form.get("submissionId") ?? "").trim();
  if (!answer) return;
  const requestedConcept = await new ConceptDiscoveryService().discover(student.id, sessionId, answer);
  const concept = requestedConcept ?? await new ConceptIntentService().resolve(student.id, sessionId, answer);
  if (concept) {
    const conceptSession = await new ConceptTutorService().start(student.id, sessionId, concept.slug, "NOT_FAMILIAR", answer);
    revalidatePath(`/study/${sessionId}`);
    redirect(`/concept-sessions/${conceptSession.id}`);
  }
  await new TutorService(new OpenAIProvider()).answer(student.id, sessionId, answer, submissionId || undefined);
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

export async function restartSession(sessionId: string) {
  const student = await requireStudent();
  const previous = await db.studySession.findFirstOrThrow({
    where: { id: sessionId, studentId: student.id },
    include: { teacherScopeNote: true },
  });
  const unit = await db.unit.findUniqueOrThrow({
    where: { id: previous.unitId },
    include: { topics: { include: { objectives: { select: { id: true } } } } },
  });
  const objectiveIds = unit.topics.flatMap((topic) => topic.objectives.map((objective) => objective.id));
  await db.$transaction([
    db.studySession.update({ where: { id: previous.id }, data: { phase: "COMPLETED", endedAt: new Date() } }),
    db.studentMastery.updateMany({
      where: { studentId: student.id, learningObjectiveId: { in: objectiveIds } },
      data: { mastery: 0, confidence: 0, attempts: 0, lastPracticedAt: null },
    }),
  ]);
  const session = await new TutorService(new OpenAIProvider()).start(
    student.id,
    previous.unitId,
    previous.teacherScopeNote?.content,
  );
  redirect(`/study/${session.id}`);
}
