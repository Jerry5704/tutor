import type { AIProvider } from "@/server/ai/contracts";
import { db } from "@/server/db/client";
import { logError, logInfo } from "@/server/observability/logger";
import { SIDE_CHAT_PROMPT_VERSION } from "@/server/prompts/side-chat";
import { AIRateLimitService } from "@/server/services/ai-rate-limit-service";
import { ConceptDiscoveryService } from "@/server/services/concept-discovery-service";
import { ConceptIntentService } from "@/server/services/concept-intent-service";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { plainTutorText } from "@/server/services/plain-tutor-text";
import { AIUsageService } from "@/server/services/ai-usage-service";
import { LearningEventService } from "@/server/services/learning-event-service";

const RATE_LIMIT_MESSAGE = "Na chwilę zatrzymuję nowe odpowiedzi AI, ponieważ wysłano ich dużo w krótkim czasie. Wróć do tego pytania za kilka minut.";
const NO_SOURCE_MESSAGE = "Nie mam teraz wystarczającego fragmentu zatwierdzonych materiałów, żeby odpowiedzieć na to rzetelnie. Nie chcę zgadywać — możesz wrócić do tego pytania później.";
const TEMPORARY_ERROR_MESSAGE = "Nie udało mi się teraz przygotować odpowiedzi. Główny tok nauki i Twój postęp są bezpieczne — spróbuj ponownie za chwilę.";

export class SideChatService {
  constructor(
    private readonly ai: AIProvider,
    private readonly knowledge = new KnowledgeService(),
    private readonly rateLimit = new AIRateLimitService(),
    private readonly aiUsage = new AIUsageService(),
    private readonly learningEvents = new LearningEventService(),
  ) {}

  async ask(studentId: string, studySessionId: string, question: string, submissionId?: string, preferredObjectiveId?: string) {
    const normalizedQuestion = question.trim().replace(/\s+/gu, " ");
    if (!normalizedQuestion) return;
    if (submissionId && await db.sideChatMessage.findUnique({ where: { submissionId } })) return;

    const session = await db.studySession.findFirst({
      where: { id: studySessionId, studentId, endedAt: null, pausedAt: null },
      include: {
        unit: {
          include: {
            topics: {
              orderBy: { order: "asc" },
              include: { objectives: { where: { active: true }, orderBy: { order: "asc" } } },
            },
          },
        },
        sideChatMessages: { orderBy: { createdAt: "desc" }, take: 6 },
      },
    });
    if (!session) throw new Error("Aktywna sesja nauki nie istnieje.");

    const objectiveId = preferredObjectiveId
      ?? session.currentObjectiveId
      ?? session.unit.topics.flatMap((topic) => topic.objectives)[0]?.id;
    const objective = objectiveId
      ? session.unit.topics.flatMap((topic) => topic.objectives).find((item) => item.id === objectiveId)
        ?? await db.learningObjective.findFirst({ where: { id: objectiveId, topic: { unitId: session.unitId } } })
      : undefined;
    if (!objective) throw new Error("Nie można ustalić aktualnego celu nauki.");

    await this.learningEvents.record({
      studentId,
      studySessionId,
      learningObjectiveId: objective.id,
      eventType: "SIDE_QUESTION_SUBMITTED",
      metadata: { characterCount: normalizedQuestion.length },
      deduplicationKey: submissionId ? `side-question:${submissionId}` : undefined,
    });

    const limit = await this.rateLimit.consume(studentId);
    if (!limit.allowed) {
      await db.sideChatMessage.createMany({
        data: [
          { studySessionId, role: "STUDENT", content: normalizedQuestion, submissionId: submissionId || null, learningObjectiveId: objective.id },
          { studySessionId, role: "TUTOR", content: RATE_LIMIT_MESSAGE, learningObjectiveId: objective.id },
        ],
        skipDuplicates: true,
      });
      return;
    }

    try {
      const discovered = await new ConceptDiscoveryService(this.ai).discover(
        studentId,
        studySessionId,
        normalizedQuestion,
        objective.id,
      );
      const concept = discovered ?? await new ConceptIntentService().resolve(studentId, studySessionId, normalizedQuestion);
      if (concept) {
        const completeConcept = await db.concept.findUniqueOrThrow({
          where: { id: concept.id },
          include: { sources: { include: { knowledgeChunk: true } } },
        });
        const answer = `${completeConcept.name}: ${completeConcept.shortDefinition}\n\n${completeConcept.simpleExplanation}`;
        await db.$transaction([
          db.sideChatMessage.create({
            data: { studySessionId, role: "STUDENT", content: normalizedQuestion, submissionId: submissionId || null, learningObjectiveId: objective.id },
          }),
          db.sideChatMessage.create({
            data: {
              studySessionId,
              role: "TUTOR",
              content: answer,
              learningObjectiveId: objective.id,
              linkedConceptId: completeConcept.id,
              sourceLocators: completeConcept.sources.map(({ knowledgeChunk }) => knowledgeChunk.locator).filter(Boolean),
              promptVersion: "concept-card-v1",
            },
          }),
        ]);
        logInfo("side_chat_concept_answered", { studentId, studySessionId, conceptId: completeConcept.id });
        return;
      }

      const knowledge = await this.knowledge.retrieveForObjective(objective.id, normalizedQuestion, 4);
      if (!knowledge.length) {
        await db.$transaction([
          db.sideChatMessage.create({ data: { studySessionId, role: "STUDENT", content: normalizedQuestion, submissionId: submissionId || null, learningObjectiveId: objective.id } }),
          db.sideChatMessage.create({ data: { studySessionId, role: "TUTOR", content: NO_SOURCE_MESSAGE, learningObjectiveId: objective.id, promptVersion: SIDE_CHAT_PROMPT_VERSION } }),
        ]);
        return;
      }

      const result = await this.aiUsage.capture({
        studentId,
        studySessionId,
        feature: "SIDE_CHAT",
        promptVersion: SIDE_CHAT_PROMPT_VERSION,
      }, () => this.ai.answerSideQuestion({
        question: normalizedQuestion,
        objectiveTitle: objective.title,
        objectiveDescription: objective.description,
        objectiveGuidance: [objective.microExplanation, objective.workedExample].filter(Boolean).join("\n"),
        knowledge,
        recentMessages: session.sideChatMessages.reverse().map((message) => ({ role: message.role, content: message.content })),
      }));
      const allowedLocators = new Set(knowledge.map((item) => item.locator));
      const acceptedLocators = [...new Set(result.value.sourceLocators.filter((locator) => allowedLocators.has(locator)))];
      await db.$transaction([
        db.sideChatMessage.create({ data: { studySessionId, role: "STUDENT", content: normalizedQuestion, submissionId: submissionId || null, learningObjectiveId: objective.id } }),
        db.sideChatMessage.create({
          data: {
            studySessionId,
            role: "TUTOR",
            content: plainTutorText(result.value.answer),
            learningObjectiveId: objective.id,
            sourceLocators: acceptedLocators,
            providerResponseId: result.responseId,
            model: result.model,
            promptVersion: SIDE_CHAT_PROMPT_VERSION,
            latencyMs: result.latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          },
        }),
      ]);
      logInfo("side_chat_answered", { studentId, studySessionId, responseId: result.responseId, sourceCount: acceptedLocators.length });
    } catch (error) {
      logError("side_chat_failed", error, { studentId, studySessionId });
      await db.sideChatMessage.createMany({
        data: [
          { studySessionId, role: "STUDENT", content: normalizedQuestion, submissionId: submissionId || null, learningObjectiveId: objective.id },
          { studySessionId, role: "TUTOR", content: TEMPORARY_ERROR_MESSAGE, learningObjectiveId: objective.id, promptVersion: SIDE_CHAT_PROMPT_VERSION },
        ],
        skipDuplicates: true,
      });
    }
  }
}
