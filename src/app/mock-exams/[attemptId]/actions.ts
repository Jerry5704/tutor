"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { requireStudent } from "@/server/auth/session";
import { MockExamService } from "@/server/services/mock-exam-service";
import { TutorService } from "@/server/services/tutor-service";

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().min(1).max(10_000),
});

export async function saveMockAnswer(attemptId: string, form: FormData) {
  const student = await requireStudent();
  const parsed = answerSchema.safeParse({ questionId: form.get("questionId"), answer: form.get("answer") });
  if (!parsed.success) throw new Error("Wpisz odpowiedź przed przejściem dalej.");
  await new MockExamService(new OpenAIProvider()).saveAnswer(
    student.id,
    attemptId,
    parsed.data.questionId,
    parsed.data.answer,
  );
  redirect(`/mock-exams/${attemptId}`);
}

export async function gradeMockExam(attemptId: string) {
  const student = await requireStudent();
  await new MockExamService(new OpenAIProvider()).grade(student.id, attemptId);
  redirect(`/mock-exams/${attemptId}`);
}

export async function startMockRemediation(attemptId: string) {
  const student = await requireStudent();
  const session = await new TutorService(new OpenAIProvider()).startMockRemediation(student.id, attemptId);
  redirect(`/study/${session.id}`);
}
