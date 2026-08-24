import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AIProvider, ConceptGenerationContext, ConceptTutorContext, QuickExplanationContext, TutorContext } from "@/server/ai/contracts";
import { conceptTurnSchema, generatedConceptSchema, quickExplanationSchema, tutorTurnSchema } from "@/server/ai/contracts";
import { quickExplanationInstructions } from "@/server/prompts/quick-explanation";
import { tutorInstructions } from "@/server/prompts/tutor";
import { conceptTutorInstructions } from "@/server/prompts/concept-tutor";
import { conceptGenerationInstructions } from "@/server/prompts/concept-generation";
import { openAIConfig } from "@/server/config/env";

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

export class OpenAIProvider implements AIProvider {
  private readonly config = openAIConfig();
  private readonly client = new OpenAI({ apiKey: this.config.apiKey });
  private readonly model = this.config.model;

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

  async assessConcept(context: ConceptTutorContext) {
    const started = Date.now();
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: conceptTutorInstructions(context),
      input: JSON.stringify({
        phase: context.phase,
        recentConversation: context.recentMessages,
        studentAnswer: context.answer,
        helpRequested: context.helpRequested,
      }),
      text: { format: zodTextFormat(conceptTurnSchema, "concept_tutor_turn") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no concept tutor turn");
    return {
      value: response.output_parsed,
      responseId: response.id,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }

  async generateConcept(context: ConceptGenerationContext) {
    const started = Date.now();
    const sourceText = context.sources.map((source) => `[${source.locator}]\n${source.content.slice(0, 3000)}`).join("\n\n");
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: conceptGenerationInstructions(context),
      input: JSON.stringify({
        requestedTerm: context.requestedTerm,
        learningObjective: context.objectiveDescription,
        sources: sourceText,
      }),
      text: { format: zodTextFormat(generatedConceptSchema, "generated_concept") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no generated concept");
    return {
      value: response.output_parsed,
      responseId: response.id,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }
}
