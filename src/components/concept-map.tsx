import Link from "next/link";
import { conceptTone, type AnnotatableConcept, type ConceptTone } from "@/server/services/concept-annotation";

type ConceptMapItem = AnnotatableConcept & {
  objectives: Array<{ learningObjective: { order: number; topic: { order: number } } }>;
};

const labels: Record<ConceptTone, string> = {
  unknown: "Niesprawdzone",
  "needs-work": "Do nauki",
  developing: "W trakcie",
  mastered: "Opanowane",
};

export function ConceptMap({ sessionId, concepts }: { sessionId: string; concepts: ConceptMapItem[] }) {
  const ordered = [...concepts].sort((left, right) => {
    const leftObjective = left.objectives[0]?.learningObjective;
    const rightObjective = right.objectives[0]?.learningObjective;
    return (leftObjective?.topic.order ?? 999) - (rightObjective?.topic.order ?? 999)
      || (leftObjective?.order ?? 999) - (rightObjective?.order ?? 999)
      || left.name.localeCompare(right.name, "pl");
  });

  return <details className="concept-map card">
    <summary>
      <span><strong>Mapa pojęć działu</strong><small>Kliknij pojęcie, aby je wyjaśnić lub przećwiczyć</small></span>
      <span className="concept-map-count">{ordered.length}</span>
    </summary>
    <div className="concept-map-legend" aria-label="Legenda stanu pojęć">
      {(Object.keys(labels) as ConceptTone[]).map((tone) => <span key={tone}><i className={`concept-dot concept-${tone}`} />{labels[tone]}</span>)}
    </div>
    <nav className="concept-map-items" aria-label="Pojęcia w tym dziale">
      {ordered.map((concept) => {
        const tone = conceptTone(concept);
        return <Link
          key={concept.id}
          href={`/study/${sessionId}/concepts/${concept.slug}`}
          className={`concept-map-item concept-${tone}`}
          title={`${labels[tone]} — otwórz pojęcie`}
        >
          <i className={`concept-dot concept-${tone}`} />
          <span>{concept.name}</span>
        </Link>;
      })}
    </nav>
  </details>;
}
