import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AIProvider, ConceptGenerationContext, ConceptTutorContext, QuickExplanationContext, TutorContext } from "@/server/ai/contracts";
import { conceptTurnSchema, generatedConceptSchema, quickExplanationSchema, tutorTurnSchema } from "@/server/ai/contracts";
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

export class OpenAIProvider implements AIProvider {
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

  async assessConcept(context: ConceptTutorContext) {
    const sourceText = context.sources.map((item) => `[${item.locator}]\n${item.content.slice(0, 2500)}`).join("\n\n");
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: `Jesteś tutorem jednego pojęcia biologicznego dla ucznia liceum. Oceniasz wyłącznie pojęcie „${context.conceptName}”.
Kontrolowana definicja: ${context.shortDefinition}
Kontrolowane wyjaśnienie: ${context.simpleExplanation}
Znaczenie: ${context.whyItMatters}
Konkretny przykład: ${context.concreteExample ?? "brak"}
Pytanie sprawdzające: ${context.checkQuestion ?? "brak"}
Pytanie transferowe: ${context.transferQuestion ?? "brak"}
Typowy błąd: ${context.commonMisconception ?? "brak zdefiniowanego błędu"}
Materiał źródłowy: ${sourceText || "brak dodatkowych fragmentów; nie dodawaj faktów spoza kontrolowanej definicji"}
Odpowiadaj po polsku i krótko. Najpierw reaguj na tok rozumowania ucznia. Jeśli odpowiedź jest błędna, daj możliwość poprawy.
Pole directAnswer służy wyłącznie do bezpośredniej odpowiedzi na ostatnie pytanie tutora, gdy helpRequested=true. Odpowiedz wtedy dokładnie na wszystkie części tego pytania, maksymalnie w 1–3 zdaniach albo krótkiej liście. Bez wstępu pedagogicznego, bez ponownego wykładu i bez kolejnego pytania. Gdy helpRequested=false, ustaw directAnswer na pusty tekst.
RECALL oznacza poprawną definicję, MECHANISM poprawne wyjaśnienie roli lub związku, TRANSFER zastosowanie w nowym przykładzie.
Jeśli uczeń pokazał tylko RECALL, nextQuestion ma sprawdzić mechanizm. Jeśli pokazał mechanizm, ustaw CORRECT i nextQuestion=null.
Nie odchodź do innych tematów i nie twórz niepotwierdzonych faktów.`,
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }

  async generateConcept(context: ConceptGenerationContext) {
    const sourceText = context.sources.map((source) => `[${source.locator}]\n${source.content.slice(0, 3000)}`).join("\n\n");
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: `Tworzysz kontrolowaną kartę jednego pojęcia biologicznego dla ucznia IV klasy liceum, poziom rozszerzony.
Użyj wyłącznie dostarczonych fragmentów zatwierdzonego źródła. Jeśli nie wystarczają do rzeczowego wyjaśnienia terminu, ustaw supportedBySources=false i pozostaw pozostałe pola krótkie.
Wyjaśnienie ma budować rozumienie: definicja, mechanizm lub relacja, konkretny przykład, typowy błąd, pytanie bez podpowiedzi oraz pytanie transferowe.
Nie nazywaj analogii faktem biologicznym. Nie dodawaj informacji, których nie ma w źródłach. Odpowiadaj po polsku.`,
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  }
}
