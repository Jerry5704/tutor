import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AIProvider, ExplanationProvider, QuickExplanationContext, TutorContext } from "@/server/ai/contracts";
import { quickExplanationSchema, tutorTurnSchema } from "@/server/ai/contracts";
import { quickExplanationInstructions } from "@/server/prompts/quick-explanation";
import { tutorInstructions } from "@/server/prompts/tutor";

export function tutorRequestInput(context: TutorContext) {
  return {
    phase: context.phase,
    objective: { code: context.objectiveCode, description: context.objectiveDescription },
    teacherScopeNote: context.teacherScopeNote ?? null,
    clarificationRequest: context.clarificationRequest,
    approvedKnowledge: context.knowledge,
    recentConversation: context.recentMessages,
    studentAnswer: context.answer,
  };
}

export class OpenAIProvider implements AIProvider, ExplanationProvider {
  private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

  async assessAndRespond(context: TutorContext) {
    const started = Date.now();
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: tutorInstructions(context),
      input: JSON.stringify(tutorRequestInput(context)),
      text: { format: zodTextFormat(tutorTurnSchema, "tutor_turn") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no structured tutor turn");
    return {
      turn: response.output_parsed,
      responseId: response.id,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }

  async explainSelection(context: QuickExplanationContext) {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: quickExplanationInstructions(context),
      input: JSON.stringify({
        selectedText: context.selectedText,
        surroundingMessage: context.surroundingMessage,
        approvedKnowledge: context.knowledge,
      }),
      text: { format: zodTextFormat(quickExplanationSchema, "quick_explanation") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no structured quick explanation");
    return response.output_parsed;
  }
}
