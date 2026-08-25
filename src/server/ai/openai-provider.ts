import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AIProvider, ConceptGenerationContext, ConceptTutorContext, QuickExplanationContext, SideChatContext, TestScopeContext, TutorContext } from "@/server/ai/contracts";
import { conceptTurnSchema, generatedConceptSchema, quickExplanationSchema, sideChatAnswerSchema, testScopeInterpretationSchema, tutorTurnSchema } from "@/server/ai/contracts";
import { quickExplanationInstructions } from "@/server/prompts/quick-explanation";
import { tutorInstructions } from "@/server/prompts/tutor";
import { conceptTutorInstructions } from "@/server/prompts/concept-tutor";
import { conceptGenerationInstructions } from "@/server/prompts/concept-generation";
import { openAIConfig } from "@/server/config/env";
import { sideChatInstructions } from "@/server/prompts/side-chat";
import { tutorRequestInput } from "@/server/ai/tutor-request-input";
import { testScopeInstructions } from "@/server/prompts/test-scope";

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
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      reasoningOutputTokens: response.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: response.usage?.total_tokens,
    };
  }

  async explainSelection(context: QuickExplanationContext) {
    const started = Date.now();
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
    return {
      value: response.output_parsed,
      responseId: response.id,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      reasoningOutputTokens: response.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: response.usage?.total_tokens,
    };
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
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      reasoningOutputTokens: response.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: response.usage?.total_tokens,
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
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      reasoningOutputTokens: response.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: response.usage?.total_tokens,
    };
  }

  async answerSideQuestion(context: SideChatContext) {
    const started = Date.now();
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: sideChatInstructions(context),
      input: JSON.stringify({
        question: context.question,
        recentConversation: context.recentMessages,
        approvedKnowledge: context.knowledge,
      }),
      text: { format: zodTextFormat(sideChatAnswerSchema, "side_chat_answer") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no structured side-chat answer");
    return {
      value: response.output_parsed,
      responseId: response.id,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      reasoningOutputTokens: response.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: response.usage?.total_tokens,
    };
  }

  async interpretTestScope(context: TestScopeContext) {
    const started = Date.now();
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: testScopeInstructions,
      input: JSON.stringify(context),
      text: { format: zodTextFormat(testScopeInterpretationSchema, "test_scope_interpretation") },
    });
    if (!response.output_parsed) throw new Error("OpenAI returned no structured test scope interpretation");
    return {
      value: response.output_parsed,
      responseId: response.id,
      model: this.model,
      latencyMs: Date.now() - started,
      inputTokens: response.usage?.input_tokens,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens,
      outputTokens: response.usage?.output_tokens,
      reasoningOutputTokens: response.usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: response.usage?.total_tokens,
    };
  }
}
