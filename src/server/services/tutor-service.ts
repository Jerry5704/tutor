import type { AIProvider, TutorTurn } from "@/server/ai/contracts";
import { db } from "@/server/db/client";
import { AssessmentService } from "@/server/services/assessment-service";
import { CurriculumService } from "@/server/services/curriculum-service";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { ConceptProgressService } from "@/server/services/concept-progress-service";
import { createStudentAnswerOnce } from "@/server/services/student-answer-idempotency";
import { resumePausedSessionData } from "@/server/services/session-lifecycle-policy";
import { requestsVisual, VisualAidService } from "@/server/services/visual-aid-service";
import {
  intentForNextAction,
  questionFingerprint,
  selectTransferQuestion,
  type QuestionIntent,
} from "@/server/services/question-history";
import {
  challengeFor,
  diagnosticMasteryDelta,
  demonstratesUnderstanding,
  explicitlyRequestsHelp,
  masteryDelta,
  nextScaffoldLevel,
  requestsBulkDiagnosticSkip,
  asksForClarification,
  confirmsUnderstanding,
} from "@/server/services/progress-policy";

type Objective = {
  id: string;
  code: string;
  title: string;
  order: number;
  description: string;
  diagnosticPrompt: string;
  transferPrompt: string;
  hook: string;
  microExplanation: string;
  workedExample: string;
  practicePrompt: string;
  visualData: unknown;
  importance: number;
};

function diagnosticQuestion(objective: Objective) {
  return `Przejdźmy do kolejnego zagadnienia: ${objective.title}.\n\n${objective.diagnosticPrompt} Jeśli nie wiesz, napisz wprost — wtedy krótko to wyjaśnię.`;
}

function guidedLesson(objective: Objective) {
  const workedExample = objective.workedExample.startsWith(objective.microExplanation)
    ? objective.workedExample.slice(objective.microExplanation.length).trim()
    : objective.workedExample;
  const exampleSection = workedExample
    ? `\n\nSprawdźmy to na przykładzie:\n${workedExample}`
    : "";
  return `Zacznijmy od konkretnej sytuacji.\n\n${objective.hook}\n\n${objective.microExplanation}${exampleSection}\n\nObejrzyj mechanizm na diagramie. Gdy będziesz gotowy, przejdziemy do osobnego pytania bez widocznej podpowiedzi.`;
}

export class TutorService {
  constructor(
    private readonly ai: AIProvider,
    private readonly curriculum = new CurriculumService(),
    private readonly assessments = new AssessmentService(),
    private readonly knowledge = new KnowledgeService(),
    private readonly visuals = new VisualAidService(),
    private readonly conceptProgress = new ConceptProgressService(),
  ) {}

  private objectives(unit: Awaited<ReturnType<CurriculumService["getUnitForStudent"]>>) {
    return unit.topics.flatMap((topic) => topic.objectives) as Objective[];
  }

  private async ensureObjectiveStates(sessionId: string, objectiveIds: string[], currentObjectiveId: string) {
    await db.sessionObjectiveState.createMany({
      data: objectiveIds.map((learningObjectiveId) => ({
        sessionId,
        learningObjectiveId,
        status: learningObjectiveId === currentObjectiveId ? "DIAGNOSING" : "NOT_STARTED",
      })),
      skipDuplicates: true,
    });
  }

  private async masteryFor(studentId: string, objectiveId: string) {
    return (await db.studentMastery.findUnique({
      where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } },
    }))?.mastery ?? 0;
  }

  async skipRemainingDiagnostic(studentId: string, sessionId: string, studentMessage?: string) {
    const session = await db.studySession.findFirstOrThrow({
      where: { id: sessionId, studentId, endedAt: null, pausedAt: null },
    });
    if (session.phase !== "DIAGNOSTIC") return;
    const unit = await this.curriculum.getUnitForStudent(session.unitId, studentId);
    const objectives = this.objectives(unit);
    const firstObjective = objectives[0];
    if (!firstObjective) throw new Error("Unit has no learning objectives");
    await this.ensureObjectiveStates(session.id, objectives.map((item) => item.id), firstObjective.id);

    await db.$transaction(async (tx) => {
      await tx.sessionObjectiveState.updateMany({
        where: { sessionId },
        data: { status: "LEARNING", learningStep: "EXPLAIN", consecutiveStruggles: 0 },
      });
      if (studentMessage?.trim()) {
        await tx.tutorMessage.create({ data: { sessionId, role: "STUDENT", content: studentMessage.trim() } });
      }
      await tx.tutorMessage.create({
        data: {
          sessionId,
          role: "TUTOR",
          content: `W porządku — kończę diagnostykę bez dalszego odpytywania. Nie obniża to wyniku; po prostu wszystkie niepotwierdzone cele trafiają do planu nauki.\n\nZaczynamy od początku książki.\n\n${guidedLesson(firstObjective)}`,
          learningObjectiveId: firstObjective.id,
          showVisual: true,
        },
      });
      await tx.sessionObjectiveState.update({
        where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: firstObjective.id } },
        data: { workedExamplesShown: { increment: 1 } },
      });
      await tx.studySession.update({
        where: { id: sessionId },
        data: { phase: "LEARNING", currentObjectiveId: firstObjective.id, scaffoldLevel: 0, objectiveAttempts: 0 },
      });
    });
  }

  async beginPractice(studentId: string, sessionId: string) {
    const session = await db.studySession.findFirstOrThrow({
      where: { id: sessionId, studentId, endedAt: null, pausedAt: null },
    });
    if (!session.currentObjectiveId) throw new Error("Session has no current objective");
    const state = await db.sessionObjectiveState.findUniqueOrThrow({
      where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: session.currentObjectiveId } },
    });
    if (state.learningStep !== "EXPLAIN") return;
    const objective = await db.learningObjective.findUniqueOrThrow({ where: { id: session.currentObjectiveId } });
    await db.$transaction([
      db.sessionObjectiveState.update({
        where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
        data: { learningStep: "PRACTICE" },
      }),
      db.tutorMessage.create({
        data: {
          sessionId,
          role: "TUTOR",
          content: `Spróbuj teraz samodzielnie, bez widocznego wyjaśnienia:\n\n${objective.practicePrompt}`,
          learningObjectiveId: objective.id,
          questionIntent: "PRACTICE",
          questionFingerprint: questionFingerprint(objective.id, objective.practicePrompt),
        },
      }),
    ]);
  }

  private async weakestObjective(studentId: string, objectives: Objective[], excludedId?: string) {
    const rows = await db.studentMastery.findMany({
      where: { studentId, learningObjectiveId: { in: objectives.map((item) => item.id) } },
    });
    const mastery = new Map(rows.map((row) => [row.learningObjectiveId, row.mastery]));
    return objectives
      .filter((item) => item.id !== excludedId)
      .sort((a, b) => ((mastery.get(a.id) ?? 0) - (mastery.get(b.id) ?? 0)) || (b.importance - a.importance))[0];
  }

  private async weakestUnmasteredObjective(studentId: string, sessionId: string, objectives: Objective[], excludedId?: string) {
    const states = await db.sessionObjectiveState.findMany({
      where: { sessionId, status: { not: "MASTERED" } },
      select: { learningObjectiveId: true },
    });
    const pending = new Set(states.map((state) => state.learningObjectiveId));
    return this.weakestObjective(studentId, objectives.filter((objective) => pending.has(objective.id)), excludedId);
  }

  private async planSummary(studentId: string, objectives: Objective[]) {
    const rows = await db.studentMastery.findMany({
      where: { studentId, learningObjectiveId: { in: objectives.map((item) => item.id) } },
    });
    const mastery = new Map(rows.map((row) => [row.learningObjectiveId, row.mastery]));
    const strong = objectives.filter((item) => (mastery.get(item.id) ?? 0) >= 0.6);
    const developing = objectives.filter((item) => (mastery.get(item.id) ?? 0) >= 0.25 && (mastery.get(item.id) ?? 0) < 0.6);
    const gaps = objectives.filter((item) => (mastery.get(item.id) ?? 0) < 0.25);
    return [
      "Diagnostyka zakończona. To wstępny obraz oparty na odpowiedziach z tej sesji.",
      strong.length ? `Mocne odpowiedzi diagnostyczne — sprawdzimy jeszcze transfer:\n${strong.map((item) => `✓ ${item.title}`).join("\n")}` : "Na razie nie mamy jeszcze potwierdzonych mocnych obszarów.",
      developing.length ? `Masz częściowe podstawy:\n${developing.map((item) => `• ${item.title}`).join("\n")}` : "",
      gaps.length ? `Musimy popracować nad:\n${gaps.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}` : "Nie wykryłem istotnych braków w tym zakresie.",
    ].filter(Boolean).join("\n\n");
  }

  async start(studentId: string, unitId: string, teacherNote?: string) {
    const existing = await db.studySession.findFirst({
      where: { studentId, unitId, endedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      const resumeData = resumePausedSessionData(existing);
      if (!resumeData) return existing;
      return db.studySession.update({ where: { id: existing.id }, data: resumeData });
    }

    const unit = await this.curriculum.getUnitForStudent(unitId, studentId);
    const objectives = this.objectives(unit);
    const objective = objectives[0];
    if (!objective) throw new Error("Unit has no learning objectives");

    const session = await db.studySession.create({ data: {
      studentId,
      unitId,
      currentObjectiveId: objective.id,
      teacherScopeNote: teacherNote?.trim() ? { create: { content: teacherNote.trim() } } : undefined,
      messages: { create: {
        role: "TUTOR",
        content: `Zanim zaczniemy naukę, sprawdźmy cały dział. Zaczynamy od zagadnienia: ${objective.title}.\n\n${objective.diagnosticPrompt} Jeśli nie wiesz, napisz wprost — wtedy krótko to wyjaśnię.`,
        learningObjectiveId: objective.id,
        questionIntent: "DIAGNOSTIC",
        questionFingerprint: questionFingerprint(objective.id, objective.diagnosticPrompt),
      } },
    } });
    await this.ensureObjectiveStates(session.id, objectives.map((item) => item.id), objective.id);
    return session;
  }

  async answer(studentId: string, sessionId: string, content: string, submissionId?: string) {
    const session = await db.studySession.findFirstOrThrow({
      where: { id: sessionId, studentId, endedAt: null, pausedAt: null },
      include: { teacherScopeNote: true, messages: { orderBy: { createdAt: "desc" }, take: 8 } },
    });
    if (!session.currentObjectiveId) throw new Error("Session has no current objective");

    const unit = await this.curriculum.getUnitForStudent(session.unitId, studentId);
    const objectives = this.objectives(unit);
    await this.ensureObjectiveStates(session.id, objectives.map((item) => item.id), session.currentObjectiveId);
    const objective = objectives.find((item) => item.id === session.currentObjectiveId);
    if (!objective) throw new Error("Current objective is outside the unit curriculum");

    if (session.awaitingUnderstandingCheck && confirmsUnderstanding(content)) {
      await db.tutorMessage.create({ data: { sessionId, role: "STUDENT", content } });
      if (session.phase !== "DIAGNOSTIC") {
        await db.$transaction([
          db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
            data: { status: "LEARNING", learningStep: "PRACTICE", clarificationAttempts: 0 },
          }),
          db.studySession.update({
            where: { id: sessionId },
            data: { awaitingUnderstandingCheck: false, scaffoldLevel: 0 },
          }),
          db.tutorMessage.create({
            data: {
              sessionId,
              role: "TUTOR",
              content: `Dobrze. Sprawdźmy to teraz bez podpowiedzi:\n\n${objective.practicePrompt}`,
              learningObjectiveId: objective.id,
              questionIntent: "PRACTICE",
              questionFingerprint: questionFingerprint(objective.id, objective.practicePrompt),
            },
          }),
        ]);
        return null;
      }
      await db.sessionObjectiveState.update({
        where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
        data: { status: "LEARNING", clarificationAttempts: 0 },
      });
      const remainingStates = await db.sessionObjectiveState.findMany({
        where: { sessionId, status: "NOT_STARTED" },
        select: { learningObjectiveId: true },
      });
      const remainingIds = new Set(remainingStates.map((item) => item.learningObjectiveId));
      const nextObjective = objectives.find((item) => remainingIds.has(item.id));
      if (nextObjective) {
        await db.$transaction([
          db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: nextObjective.id } },
            data: { status: "DIAGNOSING" },
          }),
          db.studySession.update({
            where: { id: sessionId },
            data: { currentObjectiveId: nextObjective.id, awaitingUnderstandingCheck: false, scaffoldLevel: 0 },
          }),
          db.tutorMessage.create({
            data: {
              sessionId,
              role: "TUTOR",
              content: `Dobrze. ${diagnosticQuestion(nextObjective)}`,
              learningObjectiveId: nextObjective.id,
              questionIntent: "DIAGNOSTIC",
              questionFingerprint: questionFingerprint(nextObjective.id, nextObjective.diagnosticPrompt),
            },
          }),
        ]);
      } else {
        const firstObjective = objectives[0];
        await db.$transaction([
          db.studySession.update({
            where: { id: sessionId },
            data: { phase: "LEARNING", currentObjectiveId: firstObjective.id, awaitingUnderstandingCheck: false, scaffoldLevel: 0 },
          }),
          db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: firstObjective.id } },
            data: { status: "LEARNING", learningStep: "EXPLAIN", workedExamplesShown: { increment: 1 } },
          }),
          db.tutorMessage.create({
            data: { sessionId, role: "TUTOR", content: `${await this.planSummary(studentId, objectives)}\n\n${guidedLesson(firstObjective)}`, learningObjectiveId: firstObjective.id, showVisual: true },
          }),
        ]);
      }
      return null;
    }

    if (session.phase === "DIAGNOSTIC" && requestsBulkDiagnosticSkip(content)) {
      await this.skipRemainingDiagnostic(studentId, sessionId, content);
      return null;
    }

    const answer = await createStudentAnswerOnce({
      findBySubmissionId: (id) => db.studentAnswer.findUnique({ where: { submissionId: id } }),
      create: (data) => db.studentAnswer.create({ data }),
    }, { sessionId, content, submissionId });
    if (!answer) return null;

    const currentMastery = await this.masteryFor(studentId, objective.id);
    const clarificationRequest = asksForClarification(content) || session.awaitingUnderstandingCheck;
    const forceExplanation = explicitlyRequestsHelp(content) || clarificationRequest;
    const knowledge = await this.knowledge.retrieveForObjective(objective.id, content);
    const result = await this.ai.assessAndRespond({
      phase: session.phase === "DIAGNOSTIC" ? "DIAGNOSTIC" : "LEARNING",
      objectiveCode: objective.code,
      objectiveDescription: objective.description,
      objectiveGuidance: [objective.microExplanation, objective.practicePrompt, objective.transferPrompt].join("\n"),
      scaffoldLevel: session.scaffoldLevel,
      mastery: currentMastery,
      desiredChallenge: challengeFor(currentMastery),
      forceExplanation,
      clarificationRequest,
      teacherScopeNote: session.teacherScopeNote?.content,
      knowledge,
      recentMessages: session.messages.toReversed().map(({ role, content: text }) => ({ role, content: text })),
      answer: content,
      }).catch(async (error: unknown) => {
      await db.studentAnswer.delete({ where: { id: answer.id } });
      throw error;
    });
    if (forceExplanation) {
      result.turn.assessment = "INCORRECT";
      result.turn.evidenceLevel = "NONE";
      if (result.turn.studentIntent === "ANSWER") result.turn.studentIntent = "REQUEST_HELP";
    }

    const objectiveState = await db.sessionObjectiveState.findUniqueOrThrow({
      where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
    });

    let delta = session.phase === "DIAGNOSTIC"
      ? diagnosticMasteryDelta(currentMastery, result.turn, forceExplanation)
      : masteryDelta(result.turn, session.scaffoldLevel, forceExplanation);
    if (session.phase === "LEARNING" && demonstratesUnderstanding(result.turn)) {
      const target = objectiveState.learningStep === "TRANSFER" ? 0.82 : 0.6;
      delta = Math.max(delta, Math.round(Math.max(0, target - currentMastery) * 1000) / 1000);
    }
    const scaffoldLevel = nextScaffoldLevel(result.turn, session.scaffoldLevel, forceExplanation);
    await db.tutorMessage.create({ data: { sessionId, role: "STUDENT", content } });
    const recordedAssessment = await this.assessments.record(studentId, answer.id, [objective.id], result, delta, knowledge, !clarificationRequest);
    const [updatedMastery] = recordedAssessment.masteries;
    if (!clarificationRequest && result.turn.studentIntent === "ANSWER" && result.turn.evidenceLevel !== "NONE") {
      await this.conceptProgress.recordObjectiveEvidence({
        studentId,
        learningObjectiveId: objective.id,
        assessmentId: recordedAssessment.assessmentId,
        evidenceLevel: result.turn.evidenceLevel,
        question: session.messages.find((message) => message.role === "TUTOR")?.content ?? "",
        answer: content,
      });
    }

    let phase = session.phase;
    let currentObjectiveId = objective.id;
    let tutorMessage = [result.turn.feedback, result.turn.nextQuestion].filter(Boolean).join("\n\n");
    let messageObjectiveId = objective.id;
    let questionIntent: QuestionIntent | undefined = result.turn.nextQuestion
      ? intentForNextAction(result.turn.nextAction)
      : undefined;
    let messageQuestionFingerprint = result.turn.nextQuestion
      ? questionFingerprint(objective.id, result.turn.nextQuestion)
      : undefined;
    let visualObjectiveId: string | undefined;
    let showVisual = false;
    let endedAt: Date | undefined;

    if (clarificationRequest) {
      const clarificationState = await db.sessionObjectiveState.update({
        where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
        data: { clarificationAttempts: { increment: 1 } },
      });
      visualObjectiveId = objective.id;
      showVisual = clarificationState.clarificationAttempts === 1;

      if (clarificationState.clarificationAttempts >= 2 && session.phase === "DIAGNOSTIC") {
        await db.sessionObjectiveState.update({
          where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
          data: { status: "LEARNING" },
        });
        const remainingStates = await db.sessionObjectiveState.findMany({
          where: { sessionId, status: "NOT_STARTED" },
          select: { learningObjectiveId: true },
        });
        const remainingIds = new Set(remainingStates.map((item) => item.learningObjectiveId));
        const nextObjective = objectives.find((item) => remainingIds.has(item.id));
        if (nextObjective) {
          currentObjectiveId = nextObjective.id;
          await db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: nextObjective.id } },
            data: { status: "DIAGNOSING" },
          });
          tutorMessage = `${result.turn.feedback}\n\nZapisuję ten fragment jako wymagający spokojnej nauki — wrócimy do niego w planie, zamiast powtarzać to samo.\n\n${diagnosticQuestion(nextObjective)}`;
          messageObjectiveId = nextObjective.id;
          questionIntent = "DIAGNOSTIC";
          messageQuestionFingerprint = questionFingerprint(nextObjective.id, nextObjective.diagnosticPrompt);
          visualObjectiveId = undefined;
          showVisual = false;
        } else {
          tutorMessage = `${result.turn.feedback}\n\nZapisuję ten fragment do ponownej nauki. Sprawdźmy teraz jeden mały krok własnymi słowami:\n\n${objective.practicePrompt}`;
          questionIntent = "PRACTICE";
          messageQuestionFingerprint = questionFingerprint(objective.id, objective.practicePrompt);
        }
        await db.studySession.update({ where: { id: sessionId }, data: { awaitingUnderstandingCheck: false } });
      } else if (clarificationState.clarificationAttempts >= 2) {
        tutorMessage = `${result.turn.feedback}\n\nZamiast kolejny raz pytać, czy wszystko jest jasne, sprawdźmy jeden mały krok własnymi słowami:\n\n${objective.practicePrompt}`;
        questionIntent = "PRACTICE";
        messageQuestionFingerprint = questionFingerprint(objective.id, objective.practicePrompt);
        showVisual = false;
        await db.studySession.update({ where: { id: sessionId }, data: { awaitingUnderstandingCheck: false } });
      } else {
        tutorMessage = `${result.turn.feedback}\n\nW zagadnieniu „${objective.title}” wskaż fragment, który nadal jest niejasny. Jeśli wyjaśnienie wystarcza, napisz „dalej”.`;
        questionIntent = "UNDERSTANDING_CHECK";
        messageQuestionFingerprint = questionFingerprint(objective.id, `W zagadnieniu ${objective.title} wskaż fragment, który nadal jest niejasny.`);
        await db.studySession.update({ where: { id: sessionId }, data: { awaitingUnderstandingCheck: true } });
      }
    } else if (session.phase === "DIAGNOSTIC") {
      const state = await db.sessionObjectiveState.update({
        where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
        data: { diagnosticAttempts: { increment: 1 } },
      });
      const finishProbe = demonstratesUnderstanding(result.turn)
        || forceExplanation
        || result.turn.studentIntent === "UNCERTAIN"
        || state.diagnosticAttempts >= 2;

      if (forceExplanation) {
        tutorMessage = `${result.turn.feedback}\n\nCzy wyjaśnienie zagadnienia „${objective.title}” wystarcza, czy konkretny fragment wymaga prostszego przykładu?`;
        questionIntent = "UNDERSTANDING_CHECK";
        messageQuestionFingerprint = questionFingerprint(objective.id, `Czy wyjaśnienie zagadnienia ${objective.title} wystarcza?`);
        visualObjectiveId = objective.id;
        showVisual = true;
        await db.studySession.update({ where: { id: sessionId }, data: { awaitingUnderstandingCheck: true } });
      } else if (finishProbe) {
        await db.sessionObjectiveState.update({
          where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
          data: { status: updatedMastery.mastery >= 0.75 && result.turn.evidenceLevel === "TRANSFER" ? "MASTERED" : "LEARNING" },
        });
        const remainingStates = await db.sessionObjectiveState.findMany({
          where: { sessionId, status: "NOT_STARTED" },
          select: { learningObjectiveId: true },
        });
        const remainingIds = new Set(remainingStates.map((item) => item.learningObjectiveId));
        const nextObjective = objectives.find((item) => remainingIds.has(item.id));
        if (nextObjective) {
          currentObjectiveId = nextObjective.id;
          await db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: currentObjectiveId } },
            data: { status: "DIAGNOSING" },
          });
          tutorMessage = `${result.turn.feedback}\n\n${diagnosticQuestion(nextObjective)}`;
          messageObjectiveId = nextObjective.id;
          questionIntent = "DIAGNOSTIC";
          messageQuestionFingerprint = questionFingerprint(nextObjective.id, nextObjective.diagnosticPrompt);
        } else {
          phase = "LEARNING";
          const weakest = await this.weakestObjective(studentId, objectives);
          if (weakest) {
            currentObjectiveId = weakest.id;
            await db.sessionObjectiveState.update({
              where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: weakest.id } },
            data: { status: "LEARNING", learningStep: "EXPLAIN", consecutiveStruggles: 0 },
          });
            tutorMessage = `${result.turn.feedback}\n\n${await this.planSummary(studentId, objectives)}\n\n${guidedLesson(weakest)}`;
            messageObjectiveId = weakest.id;
            questionIntent = undefined;
            messageQuestionFingerprint = undefined;
            visualObjectiveId = weakest.id;
            showVisual = true;
            await db.sessionObjectiveState.update({
              where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: weakest.id } },
              data: { learningStep: "EXPLAIN", workedExamplesShown: { increment: 1 } },
            });
          }
        }
      }
    } else {
      const understood = demonstratesUnderstanding(result.turn);
      const state = await db.sessionObjectiveState.update({
        where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
        data: {
          practicedAttempts: { increment: 1 },
          consecutiveStruggles: understood ? 0 : { increment: 1 },
        },
      });
      if (understood && objectiveState.learningStep === "PRACTICE") {
        const [mainQuestions, conceptQuestions] = await Promise.all([
          db.tutorMessage.findMany({
            where: { sessionId, learningObjectiveId: objective.id, questionFingerprint: { not: null } },
            select: { questionFingerprint: true },
          }),
          db.conceptAssessment.findMany({
            where: {
              learningObjectiveId: objective.id,
              questionFingerprint: { not: null },
              message: { session: { parentStudySessionId: sessionId } },
            },
            select: { questionFingerprint: true },
          }),
        ]);
        const transfer = selectTransferQuestion({
          learningObjectiveId: objective.id,
          objectiveTitle: objective.title,
          configuredQuestion: objective.transferPrompt,
          previousFingerprints: [...mainQuestions, ...conceptQuestions]
            .flatMap((message) => message.questionFingerprint ? [message.questionFingerprint] : []),
        });
        const transferQuestion = transfer.question;
        tutorMessage = `${result.turn.feedback}\n\nDobrze — teraz sprawdźmy transfer do nowej sytuacji.\n\n${transferQuestion}`;
        questionIntent = "TRANSFER";
        messageQuestionFingerprint = transfer.fingerprint;
        await db.sessionObjectiveState.update({
          where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
          data: { learningStep: "TRANSFER", consecutiveStruggles: 0 },
        });
      } else if (updatedMastery.mastery >= 0.78 && understood && objectiveState.learningStep === "TRANSFER") {
        await db.sessionObjectiveState.update({
          where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
          data: { status: "MASTERED" },
        });
        const next = await this.weakestUnmasteredObjective(studentId, sessionId, objectives, objective.id);
        if (next) {
          currentObjectiveId = next.id;
          await db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: next.id } },
            data: { status: "LEARNING", learningStep: "EXPLAIN", consecutiveStruggles: 0 },
          });
          tutorMessage = `${result.turn.feedback}\n\n${guidedLesson(next)}`;
          messageObjectiveId = next.id;
          questionIntent = undefined;
          messageQuestionFingerprint = undefined;
          visualObjectiveId = next.id;
          showVisual = true;
          await db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: next.id } },
            data: { learningStep: "EXPLAIN", workedExamplesShown: { increment: 1 } },
          });
        } else {
          phase = "COMPLETED";
          endedAt = new Date();
          tutorMessage = `${result.turn.feedback}\n\nNa dziś wszystkie cele tego działu mają potwierdzone opanowanie. Gotowość jest wskaźnikiem mastery, nie gwarancją oceny.`;
          questionIntent = undefined;
          messageQuestionFingerprint = undefined;
        }
      } else if (!understood && state.consecutiveStruggles >= 2) {
        if (state.workedExamplesShown === 0) {
          tutorMessage = `${result.turn.feedback}\n\nZmieńmy sposób.\n\n${guidedLesson(objective)}`;
          questionIntent = undefined;
          messageQuestionFingerprint = undefined;
          visualObjectiveId = objective.id;
          showVisual = true;
          await db.sessionObjectiveState.update({
            where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: objective.id } },
            data: { learningStep: "EXPLAIN", consecutiveStruggles: 0, workedExamplesShown: { increment: 1 } },
          });
        } else {
          const next = await this.weakestUnmasteredObjective(studentId, sessionId, objectives, objective.id);
          if (next) {
            currentObjectiveId = next.id;
            tutorMessage = `${result.turn.feedback}\n\n${guidedLesson(next)}`;
            messageObjectiveId = next.id;
            questionIntent = undefined;
            messageQuestionFingerprint = undefined;
            visualObjectiveId = next.id;
            showVisual = true;
            await db.sessionObjectiveState.update({
              where: { sessionId_learningObjectiveId: { sessionId, learningObjectiveId: next.id } },
              data: { status: "LEARNING", learningStep: "EXPLAIN", consecutiveStruggles: 0, workedExamplesShown: { increment: 1 } },
            });
          }
        }
      }
    }

    if (!visualObjectiveId && requestsVisual(content)) visualObjectiveId = objective.id;
    const visual = await this.visuals.select({
      sessionId,
      learningObjectiveId: visualObjectiveId,
      studentText: content,
      tutorText: tutorMessage,
      defaultShow: showVisual,
    });

    await db.$transaction([
      db.tutorMessage.create({ data: {
        sessionId,
        role: "TUTOR",
        content: tutorMessage,
        learningObjectiveId: messageObjectiveId,
        questionIntent,
        questionFingerprint: messageQuestionFingerprint,
        knowledgeAssetId: visual.assetId,
        showVisual: visual.showVisual,
      } }),
      db.studySession.update({ where: { id: sessionId }, data: {
        phase,
        currentObjectiveId,
        scaffoldLevel: currentObjectiveId === objective.id ? scaffoldLevel : 0,
        objectiveAttempts: currentObjectiveId === objective.id ? { increment: 1 } : 0,
        endedAt,
      } }),
    ]);
    return result.turn satisfies TutorTurn;
  }
}
