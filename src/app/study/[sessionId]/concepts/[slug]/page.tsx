import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { ConceptText } from "@/components/concept-text";
import { annotateConceptText, conceptTone } from "@/server/services/concept-annotation";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { resetConceptKnowledge, startConceptSession } from "./actions";

export default async function ConceptPage({ params, searchParams }: { params: Promise<{ sessionId: string; slug: string }>; searchParams: Promise<{ reset?: string }> }) {
  const { sessionId, slug } = await params;
  const { reset } = await searchParams;
  const student = await requireStudent();
  const session = await db.studySession.findFirst({
    where: { id: sessionId, studentId: student.id },
    include: { unit: { include: { course: true } } },
  });
  if (!session) notFound();
  const concept = await db.concept.findFirst({
    where: {
      slug,
      active: true,
      curriculumVersionId: session.unit.course.curriculumVersionId,
      ...visibleConceptsFor(student.id),
      objectives: { some: { learningObjective: { topic: { unitId: session.unitId } } } },
    },
    include: {
      aliases: true,
      studentStates: { where: { studentId: student.id } },
      outgoingRelations: { include: { targetConcept: true } },
    },
  });
  if (!concept) notFound();
  const relatedConcepts = await db.concept.findMany({
    where: {
      id: { not: concept.id },
      active: true,
      curriculumVersionId: session.unit.course.curriculumVersionId,
      ...visibleConceptsFor(student.id),
      objectives: { some: { learningObjective: { topic: { unitId: session.unitId } } } },
    },
    include: { aliases: true, studentStates: { where: { studentId: student.id } } },
  });
  const linked = (text: string) => <ConceptText sessionId={sessionId} explanationSource={{ kind: "CONCEPT_CARD", id: concept.id, studySessionId: sessionId }} segments={annotateConceptText(text, relatedConcepts)} />;
  const tone = conceptTone(concept);
  const state = concept.studentStates[0];
  return <main className="narrow concept-page">
    <Link className="button secondary" href={`/study/${sessionId}`}>← Wróć do głównej nauki</Link>
    {reset === "1" && <p className="concept-reset-confirmation">Stan pojęcia został wyzerowany. Możesz rozpocząć naukę od nowa.</p>}
    <section className="card concept-card">
      <div className="row">
        <div><p className="eyebrow">Pojęcie</p><h1>{concept.name}</h1></div>
        <span className={`concept-status concept-${tone}`}>{tone === "mastered" ? "Znam" : tone === "needs-work" ? "Do nauki" : tone === "developing" ? "W trakcie" : "Niesprawdzone"}</span>
      </div>
      {concept.origin === "AI_GENERATED" && <p className="generated-concept-note"><strong>Karta utworzona podczas rozmowy</strong><br />Treść opiera się na materiale tego działu i oczekuje na dodatkową weryfikację redakcyjną.</p>}
      <p className="concept-lead">{concept.shortDefinition}</p>
      <h2>Jak to działa?</h2><p>{linked(concept.simpleExplanation)}</p>
      {concept.concreteExample && <><h2>Konkretny przykład</h2><p className="concept-example">{linked(concept.concreteExample)}</p></>}
      <h2>Dlaczego to ważne?</h2><p>{linked(concept.whyItMatters)}</p>
      {concept.commonMisconception && <><h2>Uważaj na częsty błąd</h2><p>{linked(concept.commonMisconception)}</p></>}
      {concept.checkQuestion && <><h2>Po tej podsekcji powinieneś umieć</h2><p>{linked(concept.checkQuestion)}</p></>}
      <div className="concept-evidence">
        <strong>Stan potwierdzony przez tutora</strong>
        <span>Mastery: {Math.round((state?.mastery ?? 0) * 100)}% · dowody: {state?.evidenceCount ?? 0}</span>
      </div>
      <h2>Jak dobrze znasz to pojęcie?</h2>
      <div className="concept-start-options">
        <form action={startConceptSession.bind(null, sessionId, slug, "NOT_FAMILIAR")}><button className="button" type="submit">Nie znam — naucz mnie od zera</button></form>
        <form action={startConceptSession.bind(null, sessionId, slug, "SOMEWHAT_FAMILIAR")}><button className="button secondary" type="submit">Coś kojarzę — sprawdźmy</button></form>
        <form action={startConceptSession.bind(null, sessionId, slug, "FAMILIAR")}><button className="button secondary" type="submit">Znam — potwierdźmy</button></form>
      </div>
      {state && <form action={resetConceptKnowledge.bind(null, sessionId, slug)} className="concept-reset">
        <p><strong>Zacząć to pojęcie od nowa?</strong><br /><span className="muted">Wyzeruje mastery, pewność i deklarowaną znajomość. Historia odpowiedzi pozostanie w danych ewaluacyjnych.</span></p>
        <button className="button danger" type="submit">Wyzeruj znajomość pojęcia</button>
      </form>}
    </section>
  </main>;
}
