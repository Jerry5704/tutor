import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerForm } from "@/components/answer-form";
import { ChatAutoScroll } from "@/components/chat-auto-scroll";
import { ConceptDiagram } from "@/components/concept-diagram";
import { ConceptMap } from "@/components/concept-map";
import { ConceptText } from "@/components/concept-text";
import { ResetProgressForm } from "@/components/reset-progress-form";
import { SideChat } from "@/components/side-chat";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { annotateConceptText } from "@/server/services/concept-annotation";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { sessionAcceptsInput } from "@/server/services/session-lifecycle-policy";
import { conceptMentions } from "@/server/services/concept-mentions";
import { StudentModelService } from "@/server/services/student-model-service";
import { beginPractice, openConceptMention, pauseStudySession, resetUnitProgress, skipDiagnostic, submitAnswer, submitSideQuestion } from "./actions";

export default async function Study({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ conceptUnavailable?: string }> }) {
  const { sessionId } = await params;
  const { conceptUnavailable } = await searchParams;
  const student = await requireStudent();
  const session = await db.studySession.findFirst({
    where: { id: sessionId, studentId: student.id },
    include: {
      unit: { include: { course: true } },
      objectiveStates: { include: { learningObjective: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { learningObjective: true, knowledgeAsset: true },
      },
      sideChatMessages: { orderBy: { createdAt: "desc" }, take: 30, include: { linkedConcept: true } },
    },
  });
  if (!session) notFound();
  const concepts = await db.concept.findMany({
    where: {
      active: true,
      curriculumVersionId: session.unit.course.curriculumVersionId,
      ...visibleConceptsFor(student.id),
      objectives: { some: { learningObjective: { topic: { unitId: session.unitId } } } },
    },
    include: {
      aliases: true,
      studentStates: { where: { studentId: student.id } },
      objectives: { include: { learningObjective: { include: { topic: true } } } },
    },
  });
  const currentState = session.objectiveStates.find((state) => state.learningObjectiveId === session.currentObjectiveId);
  const awaitingPractice = session.phase === "LEARNING" && currentState?.learningStep === "EXPLAIN";
  const focusQuestion = session.phase === "LEARNING"
    && (currentState?.learningStep === "PRACTICE" || currentState?.learningStep === "TRANSFER");
  const latestMessage = session.messages.at(-1);
  const earlierMessages = focusQuestion ? session.messages.slice(0, -1) : session.messages;
  const latestVisualMessageId = latestMessage?.showVisual ? latestMessage.id : undefined;
  const completionReadiness = session.phase === "COMPLETED"
    ? await new StudentModelService().readiness(student.id, session.objectiveStates.map(({ learningObjective }) => learningObjective))
    : undefined;

  const renderMessage = (message: (typeof session.messages)[number]) => <div id={`message-${message.id}`} key={message.id} className={`bubble ${message.role === "TUTOR" ? "tutor" : "student"}`}>
    <ConceptText
      sessionId={session.id}
      explanationSource={message.role === "TUTOR" ? { kind: "STUDY_MESSAGE", id: message.id } : undefined}
      segments={annotateConceptText(message.content, concepts, Number.POSITIVE_INFINITY, conceptMentions(message.conceptMentions))}
      candidateAction={message.role === "TUTOR" ? openConceptMention.bind(null, session.id, message.id) : undefined}
    />
    {message.id === latestVisualMessageId && message.learningObjective && <ConceptDiagram data={message.learningObjective.visualData} asset={message.knowledgeAsset ?? undefined} />}
  </div>;

  return <main className="narrow">
    <div className="row">
      <div><p className="eyebrow">{session.phase === "DIAGNOSTIC" ? "Diagnostyka" : "Nauka adaptacyjna"}</p><h2>{session.unit.title}</h2></div>
      <Link className="button secondary" href="/dashboard">Wróć do dashboardu</Link>
    </div>
    <ConceptMap sessionId={session.id} concepts={concepts} />
    {conceptUnavailable === "1" && <p className="error">Nie udało się utworzyć rzetelnej karty z dostępnych materiałów. Termin pozostaje w rozmowie, ale tutor nie będzie zgadywał jego znaczenia.</p>}
    {focusQuestion && earlierMessages.length > 0 && <details className="concept-history">
      <summary>Pokaż wcześniejsze wyjaśnienie i rozmowę</summary>
      <section className="chat compact">{earlierMessages.map(renderMessage)}</section>
    </details>}
    <section className={`chat ${focusQuestion ? "concept-current" : ""}`} aria-live="polite">
      {(focusQuestion ? latestMessage ? [latestMessage] : [] : earlierMessages).map(renderMessage)}
    </section>
    <ChatAutoScroll latestMessageId={latestMessage?.id} />
    {completionReadiness !== undefined && <section className="card unit-result">
      <p className="eyebrow">Dział ukończony</p>
      <h2>Gotowość do sprawdzianu: {completionReadiness}%</h2>
      <p className="muted">To wskaźnik aktualnego opanowania materiału, a nie gwarancja oceny. Każdy poniższy cel został potwierdzony zadaniem transferowym.</p>
      <ul>{session.objectiveStates
        .filter((state) => state.status === "MASTERED")
        .map((state) => <li key={state.learningObjectiveId}>✓ {state.learningObjective.title}</li>)}</ul>
      <Link className="button" href="/dashboard">Wróć do dashboardu</Link>
    </section>}
    {sessionAcceptsInput(session) && <>
      {awaitingPractice
        ? <form action={beginPractice.bind(null, session.id)}><button type="submit" className="button">Rozumiem — sprawdź mnie bez podpowiedzi</button></form>
        : <AnswerForm action={submitAnswer.bind(null, session.id)} />}
      {session.phase === "DIAGNOSTIC" && <form action={skipDiagnostic.bind(null, session.id)}><button type="submit" className="button secondary">Nie znam jeszcze tego działu — pomiń resztę diagnostyki</button></form>}
      <form action={pauseStudySession.bind(null, session.id)}><button type="submit" className="button secondary">Zakończ na dziś i zachowaj postęp</button></form>
      <details className="card"><summary>Opcje resetowania</summary><p className="muted">Reset usuwa bieżące mastery tego działu, ale zachowuje historię do audytu.</p><ResetProgressForm action={resetUnitProgress.bind(null, session.id)} /></details>
    </>}
    {sessionAcceptsInput(session) && <SideChat sessionId={session.id} messages={session.sideChatMessages} concepts={concepts} action={submitSideQuestion.bind(null, session.id)} />}
  </main>;
}
