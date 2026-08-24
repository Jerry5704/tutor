import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerForm } from "@/components/answer-form";
import { ConceptText } from "@/components/concept-text";
import { SideChat } from "@/components/side-chat";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { annotateConceptText } from "@/server/services/concept-annotation";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { pauseConceptSession, submitConceptAnswer, submitSideQuestion } from "./actions";

function masteryLabel(mastery: number) {
  if (mastery >= 0.85) return "Bardzo dobre opanowanie";
  if (mastery >= 0.75) return "Dobre opanowanie";
  if (mastery >= 0.5) return "Częściowe opanowanie";
  return "Wymaga dalszej nauki";
}

export default async function ConceptSessionPage({ params }: { params: Promise<{ conceptSessionId: string }> }) {
  const { conceptSessionId } = await params;
  const student = await requireStudent();
  const session = await db.conceptSession.findFirst({
    where: { id: conceptSessionId, studentId: student.id },
    include: {
      concept: { include: { aliases: true, studentStates: { where: { studentId: student.id } } } },
      parentStudySession: { include: { unit: { include: { course: true } }, sideChatMessages: { orderBy: { createdAt: "desc" }, take: 30, include: { linkedConcept: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) notFound();
  const state = session.concept.studentStates[0];
  const returnHref = session.parentConceptSessionId
    ? `/concept-sessions/${session.parentConceptSessionId}`
    : `/study/${session.parentStudySessionId}${session.returnToMessageId ? `#message-${session.returnToMessageId}` : ""}`;
  const focusQuestion = session.status === "ACTIVE" && (session.phase === "PRACTICE" || session.phase === "CHECK");
  const currentMessage = session.messages.at(-1);
  const earlierMessages = focusQuestion ? session.messages.slice(0, -1) : session.messages;
  const relatedConcepts = await db.concept.findMany({
    where: {
      id: { not: session.conceptId },
      active: true,
      curriculumVersionId: session.parentStudySession.unit.course.curriculumVersionId,
      ...visibleConceptsFor(student.id),
      objectives: { some: { learningObjective: { topic: { unitId: session.parentStudySession.unitId } } } },
    },
    include: { aliases: true, studentStates: { where: { studentId: student.id } } },
  });
  const messageContent = (message: (typeof session.messages)[number]) => <ConceptText
    sessionId={session.parentStudySessionId}
    explanationSource={message.role === "TUTOR" ? { kind: "CONCEPT_MESSAGE", id: message.id } : undefined}
    segments={annotateConceptText(message.content, relatedConcepts)}
  />;
  return <main className="narrow concept-session-page">
    <div className="row"><div><p className="eyebrow">Boczna ścieżka pojęcia</p><h1>{session.concept.name}</h1></div><span className="concept-session-badge">Główny tok jest wstrzymany</span></div>
    {session.status === "COMPLETED" ? <section className="card concept-result">
      <p className="eyebrow">Podsekcja ukończona</p>
      <h2>{masteryLabel(state?.mastery ?? 0)}</h2>
      <div className="concept-result-score">{Math.round((state?.mastery ?? 0) * 100)}%</div>
      <p>Potwierdziłeś rozumienie pojęcia „{session.concept.name}”. Wynik opisuje zebrane dowody, a nie przewidywaną ocenę szkolną.</p>
      <div className="concept-evidence"><strong>Siła dowodów</strong><span>{state?.evidenceCount ?? 0} odpowiedzi · pewność {Math.round((state?.confidence ?? 0) * 100)}%</span></div>
      <Link className="button" href={returnHref}>Wróć do głównej nauki</Link>
    </section> : <>
      {focusQuestion && earlierMessages.length > 0 && <details className="concept-history">
        <summary>Pokaż wcześniejsze wyjaśnienie i rozmowę</summary>
        <section className="chat compact">
          {earlierMessages.map((message) => <div key={message.id} className={`bubble ${message.role === "TUTOR" ? "tutor" : "student"}`}>{messageContent(message)}</div>)}
        </section>
      </details>}
      <section className="chat concept-current" aria-live="polite">
        {(focusQuestion ? currentMessage ? [currentMessage] : [] : earlierMessages).map((message) => <div key={message.id} className={`bubble ${message.role === "TUTOR" ? "tutor" : "student"}`}>{messageContent(message)}</div>)}
      </section>
    </>}
    {session.status === "ACTIVE" && <>
      <AnswerForm action={submitConceptAnswer.bind(null, session.id)} />
      <form action={pauseConceptSession.bind(null, session.id)}><button className="button secondary" type="submit">Odłóż na później i wróć</button></form>
    </>}
    {session.parentStudySession.endedAt === null && session.parentStudySession.pausedAt === null && <SideChat
      sessionId={session.parentStudySessionId}
      messages={session.parentStudySession.sideChatMessages}
      concepts={[session.concept, ...relatedConcepts]}
      action={submitSideQuestion.bind(null, session.id)}
    />}
  </main>;
}
