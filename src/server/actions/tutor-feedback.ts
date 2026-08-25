"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { LearningEventService } from "@/server/services/learning-event-service";

const feedbackSchema = z.object({
  targetType: z.enum(["STUDY_MESSAGE", "CONCEPT_MESSAGE", "SIDE_CHAT_MESSAGE"]),
  targetId: z.string().min(1).max(100),
  rating: z.enum(["HELPFUL", "NOT_HELPFUL"]),
});

export async function submitTutorFeedback(targetType: string, targetId: string, rating: string) {
  const student = await requireStudent();
  const parsed = feedbackSchema.safeParse({ targetType, targetId, rating });
  if (!parsed.success) throw new Error("Nieprawidłowa ocena odpowiedzi.");

  let studySessionId: string;
  let conceptSessionId: string | undefined;
  if (parsed.data.targetType === "STUDY_MESSAGE") {
    const message = await db.tutorMessage.findFirst({
      where: { id: parsed.data.targetId, role: "TUTOR", session: { studentId: student.id } },
      select: { sessionId: true },
    });
    if (!message) throw new Error("Nie znaleziono odpowiedzi tutora.");
    studySessionId = message.sessionId;
  } else if (parsed.data.targetType === "CONCEPT_MESSAGE") {
    const message = await db.conceptMessage.findFirst({
      where: { id: parsed.data.targetId, role: "TUTOR", session: { studentId: student.id } },
      select: { conceptSessionId: true, session: { select: { parentStudySessionId: true } } },
    });
    if (!message) throw new Error("Nie znaleziono odpowiedzi tutora.");
    studySessionId = message.session.parentStudySessionId;
    conceptSessionId = message.conceptSessionId;
  } else {
    const message = await db.sideChatMessage.findFirst({
      where: { id: parsed.data.targetId, role: "TUTOR", studySession: { studentId: student.id } },
      select: { studySessionId: true },
    });
    if (!message) throw new Error("Nie znaleziono odpowiedzi tutora.");
    studySessionId = message.studySessionId;
  }

  await db.tutorResponseFeedback.upsert({
    where: {
      studentId_targetType_targetId: {
        studentId: student.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      },
    },
    update: { rating: parsed.data.rating },
    create: { studentId: student.id, ...parsed.data },
  });
  await new LearningEventService().record({
    studentId: student.id,
    studySessionId,
    eventType: "TUTOR_FEEDBACK_SUBMITTED",
    metadata: { targetType: parsed.data.targetType, rating: parsed.data.rating },
  });

  revalidatePath(`/study/${studySessionId}`);
  if (conceptSessionId) revalidatePath(`/concept-sessions/${conceptSessionId}`);
}
