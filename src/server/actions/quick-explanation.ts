"use server";

import { z } from "zod";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { requireStudent } from "@/server/auth/session";
import { QuickExplanationService } from "@/server/services/quick-explanation-service";

const requestSchema = z.object({
  sourceKind: z.enum(["STUDY_MESSAGE", "CONCEPT_MESSAGE", "CONCEPT_CARD"]),
  sourceId: z.string().min(1),
  sentence: z.string().trim().min(2).max(600),
  studySessionId: z.string().min(1).optional(),
});

export type QuickExplanationResult = {
  explanation?: string;
  error?: string;
};

export async function explainSentence(
  sourceKind: "STUDY_MESSAGE" | "CONCEPT_MESSAGE" | "CONCEPT_CARD",
  sourceId: string,
  sentence: string,
  studySessionId?: string,
): Promise<QuickExplanationResult> {
  const student = await requireStudent();
  const parsed = requestSchema.safeParse({ sourceKind, sourceId, sentence, studySessionId });
  if (!parsed.success) return { error: "Nie można wyjaśnić tego zdania." };

  try {
    const result = await new QuickExplanationService(new OpenAIProvider()).explain(
      student.id,
      parsed.data,
    );
    return { explanation: result.explanation };
  } catch (error) {
    console.error("quick_explanation_failed", {
      sourceKind: parsed.data.sourceKind,
      sourceId: parsed.data.sourceId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return { error: "Nie udało się przygotować wyjaśnienia. Spróbuj ponownie." };
  }
}
