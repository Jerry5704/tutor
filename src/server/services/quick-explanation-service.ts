import type { ExplanationProvider } from "@/server/ai/contracts";
import { db } from "@/server/db/client";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { AIUsageService } from "@/server/services/ai-usage-service";
import { QUICK_EXPLANATION_PROMPT_VERSION } from "@/server/prompts/quick-explanation";
import { LearningEventService } from "@/server/services/learning-event-service";

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export class QuickExplanationService {
  constructor(
    private readonly provider: ExplanationProvider,
    private readonly knowledge = new KnowledgeService(),
    private readonly aiUsage = new AIUsageService(),
    private readonly learningEvents = new LearningEventService(),
  ) {}

  async explain(studentId: string, request: {
    sourceKind: "STUDY_MESSAGE" | "CONCEPT_MESSAGE" | "CONCEPT_CARD";
    sourceId: string;
    sentence: string;
    studySessionId?: string;
  }) {
    const sentence = normalized(request.sentence);
    let surroundingMessage: string;
    let objectiveId: string;
    let extraGuidance = "";
    let studySessionId = request.studySessionId;

    if (request.sourceKind === "STUDY_MESSAGE") {
      const message = await db.tutorMessage.findFirst({
        where: { id: request.sourceId, role: "TUTOR", session: { studentId } },
        include: { session: true },
      });
      if (!message) throw new Error("Nie znaleziono wiadomości tutora.");
      surroundingMessage = message.content;
      objectiveId = message.learningObjectiveId ?? message.session.currentObjectiveId ?? "";
      studySessionId = message.sessionId;
    } else if (request.sourceKind === "CONCEPT_MESSAGE") {
      const message = await db.conceptMessage.findFirst({
        where: { id: request.sourceId, role: "TUTOR", session: { studentId } },
        include: { session: { include: { concept: { include: { objectives: true } } } } },
      });
      if (!message) throw new Error("Nie znaleziono wiadomości podsekcji.");
      surroundingMessage = message.content;
      objectiveId = message.session.concept.objectives[0]?.learningObjectiveId ?? "";
      studySessionId = message.session.parentStudySessionId;
      extraGuidance = message.session.concept.simpleExplanation;
    } else {
      if (!request.studySessionId) throw new Error("Brak sesji nadrzędnej.");
      const studySession = await db.studySession.findFirst({
        where: { id: request.studySessionId, studentId },
        include: { unit: { include: { course: true } } },
      });
      if (!studySession) throw new Error("Nie znaleziono sesji nauki.");
      const concept = await db.concept.findFirst({
        where: {
          id: request.sourceId,
          active: true,
          curriculumVersionId: studySession.unit.course.curriculumVersionId,
          ...visibleConceptsFor(studentId),
          objectives: { some: { learningObjective: { topic: { unitId: studySession.unitId } } } },
        },
        include: { objectives: true },
      });
      if (!concept) throw new Error("Nie znaleziono pojęcia.");
      surroundingMessage = [concept.shortDefinition, concept.simpleExplanation, concept.concreteExample, concept.whyItMatters, concept.commonMisconception, concept.checkQuestion].filter(Boolean).join("\n");
      objectiveId = concept.objectives[0]?.learningObjectiveId ?? "";
      extraGuidance = concept.simpleExplanation;
    }

    if (!normalized(surroundingMessage).includes(sentence)) throw new Error("Zdanie nie należy do wskazanego źródła.");
    if (!objectiveId) throw new Error("Źródło nie ma przypisanego celu nauki.");
    if (!studySessionId) throw new Error("Źródło nie ma przypisanej sesji nauki.");
    const objective = await db.learningObjective.findUniqueOrThrow({ where: { id: objectiveId } });
    const knowledge = await this.knowledge.retrieveForObjective(objective.id, sentence, 3);

    await this.learningEvents.record({
      studentId,
      studySessionId,
      learningObjectiveId: objective.id,
      eventType: "QUICK_EXPLANATION_REQUESTED",
      metadata: { sourceKind: request.sourceKind, characterCount: sentence.length },
    });

    return this.aiUsage.capture({
      studentId,
      studySessionId,
      feature: "QUICK_EXPLANATION",
      promptVersion: QUICK_EXPLANATION_PROMPT_VERSION,
    }, () => this.provider.explainSelection({
      selectedText: sentence,
      surroundingMessage,
      objectiveTitle: objective.title,
      objectiveDescription: objective.description,
      objectiveGuidance: [objective.microExplanation, objective.workedExample, extraGuidance].filter(Boolean).join("\n"),
      knowledge,
    }));
  }
}
