import type { ConceptAIProvider, ConceptTurn } from "@/server/ai/contracts";
import { db } from "@/server/db/client";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { capMasteryBeforeTransfer, confirmsUnderstanding, explicitlyRequestsHelp } from "@/server/services/progress-policy";
import { aggregateConceptMastery } from "@/server/services/concept-evidence-policy";
import { questionFingerprint } from "@/server/services/question-history";
import { CONCEPT_TUTOR_PROMPT_VERSION } from "@/server/prompts/concept-tutor";
import { logError, logInfo } from "@/server/observability/logger";


function targetMastery(assessment: ConceptTurn["assessment"], evidence: ConceptTurn["evidenceLevel"]) {
  if (assessment === "TRANSFER_DEMONSTRATED" && evidence === "TRANSFER") return 0.85;
  if (assessment === "CORRECT" && (evidence === "MECHANISM" || evidence === "TRANSFER")) return 0.78;
  if (assessment === "CORRECT") return 0.55;
  if (assessment === "PARTIALLY_CORRECT") return 0.35;
  return 0.12;
}

export class ConceptTutorService {
  constructor(
    private readonly ai: ConceptAIProvider,
    private readonly knowledge = new KnowledgeService(),
  ) {}

  private explanation(concept: { shortDefinition: string; simpleExplanation: string; whyItMatters: string; concreteExample: string | null }) {
    return `${concept.shortDefinition}\n\n${concept.simpleExplanation}\n\nPrzykład:\n${concept.concreteExample ?? concept.whyItMatters}\n\nDlaczego to ważne:\n${concept.whyItMatters}`;
  }

  async start(studentId: string, parentStudySessionId: string, conceptSlug: string, selfFamiliarity: "NOT_FAMILIAR" | "SOMEWHAT_FAMILIAR" | "FAMILIAR", entryQuestion?: string, parentConceptSessionId?: string) {
    const parent = await db.studySession.findFirstOrThrow({
      where: { id: parentStudySessionId, studentId, endedAt: null, pausedAt: null },
      include: { unit: { include: { course: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const concept = await db.concept.findFirstOrThrow({
      where: {
        slug: conceptSlug,
        active: true,
        curriculumVersionId: parent.unit.course.curriculumVersionId,
        ...visibleConceptsFor(studentId),
        objectives: { some: { learningObjective: { topic: { unitId: parent.unitId } } } },
      },
    });
    await db.studentConceptState.upsert({
      where: { studentId_conceptId: { studentId, conceptId: concept.id } },
      update: { selfFamiliarity },
      create: { studentId, conceptId: concept.id, selfFamiliarity },
    });
    const existing = await db.conceptSession.findFirst({
      where: { studentId, conceptId: concept.id, parentStudySessionId, status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      return db.$transaction(async (tx) => {
        const reorient = existing.status === "PAUSED" || Boolean(entryQuestion?.trim());
        const resumed = await tx.conceptSession.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", phase: reorient ? "EXPLAIN" : existing.phase },
        });
        if (entryQuestion?.trim()) {
          await tx.conceptMessage.createMany({ data: [
            { conceptSessionId: existing.id, role: "STUDENT", content: entryQuestion.trim() },
            { conceptSessionId: existing.id, role: "TUTOR", content: `${this.explanation(concept)}\n\nNie musisz tego od razu odtwarzać. Jeśli ten obraz jest jasny, napisz „dalej”. Możesz też wskazać konkretny fragment, który mam wyjaśnić prościej.` },
          ] });
        } else if (existing.status === "PAUSED") {
          await tx.conceptMessage.create({
            data: {
              conceptSessionId: existing.id,
              role: "TUTOR",
              content: `Wróćmy do tego inaczej, bez powtarzania poprzedniego pytania.\n\n${this.explanation(concept)}\n\nJeśli ten obraz jest jasny, napisz „dalej”. Jeśli nie, wskaż konkretny fragment lub słowo.`,
            },
          });
        }
        return resumed;
      });
    }
    const opening = `${this.explanation(concept)}\n\nNajpierw upewnijmy się, że wyjaśnienie jest jasne. Napisz „dalej”, aby sprawdzić je jednym pytaniem, albo wskaż fragment, który mam wyjaśnić inaczej.`;
    return db.conceptSession.create({
      data: {
        studentId,
        conceptId: concept.id,
        parentStudySessionId,
        returnToMessageId: parent.messages[0]?.id,
        parentConceptSessionId,
        phase: "EXPLAIN",
        messages: { create: entryQuestion?.trim()
          ? [{ role: "STUDENT", content: entryQuestion.trim() }, { role: "TUTOR", content: opening }]
          : [{ role: "TUTOR", content: opening }] },
      },
    });
  }

  async answer(studentId: string, conceptSessionId: string, answer: string, submissionId?: string) {
    if (submissionId && await db.conceptMessage.findUnique({ where: { submissionId } })) {
      const existingSession = await db.conceptSession.findFirstOrThrow({ where: { id: conceptSessionId, studentId } });
      return { completed: existingSession.status === "COMPLETED", parentStudySessionId: existingSession.parentStudySessionId, returnToMessageId: existingSession.returnToMessageId };
    }
    const session = await db.conceptSession.findFirstOrThrow({
      where: { id: conceptSessionId, studentId, status: "ACTIVE" },
      include: {
        concept: {
          include: {
            sources: { include: { knowledgeChunk: true } },
            objectives: { select: { learningObjectiveId: true, importance: true }, orderBy: { importance: "desc" }, take: 1 },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    });
    const state = await db.studentConceptState.findUnique({
      where: { studentId_conceptId: { studentId, conceptId: session.conceptId } },
    });
    if (session.phase === "EXPLAIN" && confirmsUnderstanding(answer)) {
      const question = session.scaffoldLevel > 0
        ? session.concept.transferQuestion ?? session.concept.checkQuestion
        : session.concept.checkQuestion;
      await db.$transaction([
        db.conceptMessage.create({ data: { conceptSessionId, role: "STUDENT", content: answer, submissionId } }),
        db.conceptMessage.create({ data: { conceptSessionId, role: "TUTOR", content: `Dobrze. Teraz sprawdźmy to bez podpowiedzi:\n\n${question ?? `Wyjaśnij własnymi słowami pojęcie „${session.concept.name}”.`}` } }),
        db.conceptSession.update({ where: { id: conceptSessionId }, data: { phase: session.scaffoldLevel > 0 ? "CHECK" : "PRACTICE" } }),
      ]);
      return { completed: false, parentStudySessionId: session.parentStudySessionId, returnToMessageId: session.returnToMessageId, parentConceptSessionId: session.parentConceptSessionId };
    }
    const objectiveId = session.concept.objectives[0]?.learningObjectiveId;
    const retrieved = objectiveId ? await this.knowledge.retrieveForObjective(objectiveId, `${session.concept.name} ${answer}`, 2) : [];
    const directSources = session.concept.sources.map((item) => ({
      locator: item.knowledgeChunk.locator ?? "brak lokalizatora",
      content: item.knowledgeChunk.content,
    }));
    const sources = [...directSources, ...retrieved.map((item) => ({ locator: item.locator, content: item.content }))]
      .filter((item, index, all) => all.findIndex((other) => other.locator === item.locator) === index)
      .slice(0, 3);
    const help = explicitlyRequestsHelp(answer);
    const latestTutorQuestion = session.messages.find((message) => message.role === "TUTOR")?.content ?? "";
    const aiResult = await this.ai.assessConcept({
      conceptName: session.concept.name,
      shortDefinition: session.concept.shortDefinition,
      simpleExplanation: session.concept.simpleExplanation,
      whyItMatters: session.concept.whyItMatters,
      concreteExample: session.concept.concreteExample ?? undefined,
      checkQuestion: session.concept.checkQuestion ?? undefined,
      transferQuestion: session.concept.transferQuestion ?? undefined,
      commonMisconception: session.concept.commonMisconception ?? undefined,
      sources,
      phase: session.phase,
      recentMessages: session.messages.toReversed().map((message) => ({ role: message.role, content: message.content })),
      answer,
      helpRequested: help,
    }).catch((error: unknown) => {
      logError("concept_tutor_ai_failed", error, {
        studentId,
        conceptSessionId,
        conceptId: session.conceptId,
        learningObjectiveId: objectiveId,
        phase: session.phase,
      });
      throw error;
    });
    const turn = aiResult.value;
    const target = help ? (state?.mastery ?? 0) : targetMastery(turn.assessment, turn.evidenceLevel);
    const previousMastery = state?.mastery ?? 0;
    const nextMastery = Math.max(previousMastery, target);
    const delta = Math.round((nextMastery - previousMastery) * 1000) / 1000;
    const completed = !help && nextMastery >= 0.75 && (turn.evidenceLevel === "MECHANISM" || turn.evidenceLevel === "TRANSFER");
    let objectiveMasteryBefore: number | undefined;
    let objectiveMasteryAfter: number | undefined;
    let objectiveConfidenceAfter: number | undefined;
    if (completed && objectiveId) {
      const [links, conceptStates, objectiveMastery] = await Promise.all([
        db.conceptObjective.findMany({
          where: { learningObjectiveId: objectiveId },
          select: { conceptId: true, importance: true },
        }),
        db.studentConceptState.findMany({
          where: { studentId, concept: { objectives: { some: { learningObjectiveId: objectiveId } } } },
          select: { conceptId: true, mastery: true },
        }),
        db.studentMastery.findUnique({
          where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } },
        }),
      ]);
      const masteryByConcept = new Map(conceptStates.map((item) => [item.conceptId, item.mastery]));
      masteryByConcept.set(session.conceptId, nextMastery);
      objectiveMasteryBefore = objectiveMastery?.mastery ?? 0;
      objectiveMasteryAfter = capMasteryBeforeTransfer(aggregateConceptMastery({
        links,
        masteryByConcept,
        currentObjectiveMastery: objectiveMasteryBefore,
      }));
      objectiveConfidenceAfter = Math.min(1, (objectiveMastery?.confidence ?? 0) + 0.05);
    }
    const helpContent = `${turn.directAnswer.trim() || turn.feedback}\n\nCzy ta konkretna odpowiedź jest jasna? Jeśli tak, napisz „dalej”. Jeśli nie, wskaż słowo lub fragment, który mam rozwinąć.`;
    const correctionContent = `${turn.feedback}\n\n${session.concept.concreteExample ? `Spójrz jeszcze raz na przykład:\n${session.concept.concreteExample}\n\n` : ""}Nie przechodzimy od razu do następnego pytania. Jeśli poprawka jest jasna, napisz „dalej”; wtedy dostaniesz nowe zadanie bez widocznej podpowiedzi.`;
    const tutorContent = completed
      ? `${turn.feedback}\n\nMasz potwierdzone rozumienie pojęcia „${session.concept.name}”. Wracamy do głównego wątku.`
      : help
        ? helpContent
        : turn.assessment === "INCORRECT"
          ? correctionContent
          : [turn.feedback, turn.nextQuestion ?? session.concept.transferQuestion ?? `Wyjaśnij rolę pojęcia „${session.concept.name}” na konkretnym przykładzie.`].join("\n\n");

    await db.$transaction(async (tx) => {
      const studentMessage = await tx.conceptMessage.create({ data: { conceptSessionId, role: "STUDENT", content: answer, submissionId } });
      await tx.conceptAssessment.create({ data: {
        conceptMessageId: studentMessage.id,
        learningObjectiveId: objectiveId,
        questionIntent: objectiveId && latestTutorQuestion
          ? session.phase === "CHECK" ? "TRANSFER" : session.phase === "PRACTICE" ? "PRACTICE" : "UNDERSTANDING_CHECK"
          : undefined,
        questionFingerprint: objectiveId && latestTutorQuestion ? questionFingerprint(objectiveId, latestTutorQuestion) : undefined,
        rating: help ? "INCORRECT" : turn.assessment,
        evidenceLevel: help ? "NONE" : turn.evidenceLevel,
        masteryDelta: delta,
        conceptMasteryBefore: previousMastery,
        conceptMasteryAfter: nextMastery,
        objectiveMasteryBefore,
        objectiveMasteryAfter,
        rationale: turn.rationale,
        providerResponseId: aiResult.responseId,
        model: aiResult.model,
        promptVersion: CONCEPT_TUTOR_PROMPT_VERSION,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        latencyMs: aiResult.latencyMs,
        knowledgeLocators: sources.map((item) => item.locator),
      } });
      await tx.conceptMessage.create({ data: { conceptSessionId, role: "TUTOR", content: tutorContent } });
      await tx.studentConceptState.upsert({
        where: { studentId_conceptId: { studentId, conceptId: session.conceptId } },
        update: {
          mastery: nextMastery,
          confidence: Math.min(1, (state?.confidence ?? 0) + (help ? 0 : 0.2)),
          attempts: { increment: 1 },
          evidenceCount: help ? undefined : { increment: 1 },
          lastPracticedAt: new Date(),
        },
        create: { studentId, conceptId: session.conceptId, mastery: nextMastery, confidence: help ? 0 : 0.2, attempts: 1, evidenceCount: help ? 0 : 1, lastPracticedAt: new Date() },
      });
      if (completed && objectiveId && objectiveMasteryAfter !== undefined) {
        await tx.studentMastery.upsert({
          where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } },
          create: {
            studentId,
            learningObjectiveId: objectiveId,
            mastery: objectiveMasteryAfter,
            confidence: 0.2,
            attempts: 1,
            lastPracticedAt: new Date(),
          },
          update: {
            mastery: objectiveMasteryAfter,
            confidence: objectiveConfidenceAfter,
            attempts: { increment: 1 },
            lastPracticedAt: new Date(),
          },
        });
      }
      await tx.conceptSession.update({
        where: { id: conceptSessionId },
        data: {
          phase: completed ? "CHECK" : help || turn.assessment === "INCORRECT" ? "EXPLAIN" : turn.evidenceLevel === "RECALL" ? "CHECK" : "PRACTICE",
          scaffoldLevel: help || turn.assessment === "INCORRECT" ? { increment: 1 } : session.scaffoldLevel,
          status: completed ? "COMPLETED" : "ACTIVE",
          endedAt: completed ? new Date() : null,
        },
      });
    });
    logInfo("concept_assessment_recorded", {
      studentId,
      conceptSessionId,
      conceptId: session.conceptId,
      learningObjectiveId: objectiveId,
      phase: session.phase,
      rating: help ? "INCORRECT" : turn.assessment,
      evidenceLevel: help ? "NONE" : turn.evidenceLevel,
      masteryDelta: delta,
      completed,
      model: aiResult.model,
      providerResponseId: aiResult.responseId,
      latencyMs: aiResult.latencyMs,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
    });
    return { completed, parentStudySessionId: session.parentStudySessionId, returnToMessageId: session.returnToMessageId, parentConceptSessionId: session.parentConceptSessionId };
  }

  async pause(studentId: string, conceptSessionId: string) {
    return db.conceptSession.update({
      where: { id: conceptSessionId, studentId },
      data: { status: "PAUSED" },
      select: { parentStudySessionId: true, returnToMessageId: true, parentConceptSessionId: true },
    });
  }

  async reset(studentId: string, parentStudySessionId: string, conceptSlug: string) {
    const parent = await db.studySession.findFirstOrThrow({
      where: { id: parentStudySessionId, studentId },
      include: { unit: { include: { course: true } } },
    });
    const concept = await db.concept.findFirstOrThrow({
      where: {
        slug: conceptSlug,
        active: true,
        curriculumVersionId: parent.unit.course.curriculumVersionId,
        ...visibleConceptsFor(studentId),
        objectives: { some: { learningObjective: { topic: { unitId: parent.unitId } } } },
      },
    });
    await db.$transaction([
      db.conceptSession.updateMany({
        where: { studentId, parentStudySessionId, conceptId: concept.id, status: { in: ["ACTIVE", "PAUSED"] } },
        data: { status: "RESET", endedAt: new Date() },
      }),
      db.studentConceptState.deleteMany({ where: { studentId, conceptId: concept.id } }),
    ]);
  }
}
