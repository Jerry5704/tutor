"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStudent } from "@/server/auth/session";
import { ConceptTutorService } from "@/server/services/concept-tutor-service";
import { OpenAIProvider } from "@/server/ai/openai-provider";

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
