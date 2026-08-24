import Link from "next/link";
import { ConceptText } from "@/components/concept-text";
import { SideQuestionForm } from "@/components/side-question-form";
import { annotateConceptText, type AnnotatableConcept } from "@/server/services/concept-annotation";

type SideMessage = {
  id: string;
  role: "TUTOR" | "STUDENT";
  content: string;
  createdAt: Date;
  linkedConcept: { slug: string; name: string } | null;
};

export function SideChat({ sessionId, messages, concepts, action }: {
  sessionId: string;
  messages: SideMessage[];
  concepts: AnnotatableConcept[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const ordered = [...messages].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  return <details className="side-chat-drawer" open={ordered.length > 0 ? true : undefined}>
    <summary><span aria-hidden="true">?</span><strong>Pytanie poboczne</strong></summary>
    <section className="side-chat-panel">
      <header><div><p className="eyebrow">Bez przerywania nauki</p><h2>Dopytaj tutora</h2></div><small className="muted">Wątek zapisuje się z tą sesją.</small></header>
      {ordered.length > 0
        ? <div className="side-chat-log" aria-live="polite">{ordered.map((message) => <div key={message.id} className={`side-chat-bubble ${message.role === "TUTOR" ? "tutor" : "student"}`}>
          <ConceptText sessionId={sessionId} segments={annotateConceptText(message.content, concepts)} />
          {message.linkedConcept && <Link className="side-chat-concept-link" href={`/study/${sessionId}/concepts/${message.linkedConcept.slug}`}>Otwórz kartę: {message.linkedConcept.name} →</Link>}
        </div>)}</div>
        : <p className="muted side-chat-empty">Zapytaj o termin lub fragment biologii, którego teraz nie rozumiesz.</p>}
      <SideQuestionForm action={action} />
    </section>
  </details>;
}
