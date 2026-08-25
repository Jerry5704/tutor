import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { confirmTestPlan } from "../actions";

const scopeLabels = {
  INCLUDED: "W zakresie",
  PRIORITY: "Szczególnie ważne",
  EXCLUDED: "Wykluczone",
} as const;

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isPageRange(value: unknown): value is { from: number; to: number } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.from === "number" && typeof item.to === "number";
}

export default async function TestPlanReviewPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const student = await requireStudent();
  const plan = await db.testPlan.findFirst({
    where: { studentId: student.id, unitId, status: "DRAFT" },
    orderBy: { updatedAt: "desc" },
    include: {
      unit: true,
      objectives: { include: { learningObjective: { include: { topic: true } } } },
    },
  });
  if (!plan) notFound();
  const objectives = plan.objectives.toSorted((left, right) =>
    left.learningObjective.topic.order - right.learningObjective.topic.order
    || left.learningObjective.order - right.learningObjective.order,
  );
  const taskTypes = stringArray(plan.expectedTaskTypes);
  const pageRanges = Array.isArray(plan.declaredPageRanges)
    ? plan.declaredPageRanges.filter(isPageRange)
    : [];

  return <main className="shell test-plan-page">
    <div className="row"><div><p className="eyebrow">Zakres do zatwierdzenia</p><h1>{plan.unit.title}</h1></div><Link className="button secondary" href={`/units/${unitId}`}>Wróć</Link></div>
    <section className="card test-plan-summary">
      <div><strong>Sprawdzian</strong><span>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(plan.testDate)}</span></div>
      <div><strong>Nauka dziennie</strong><span>{plan.dailyMinutes} min</span></div>
      {plan.originalTeacherNote && <div className="test-plan-note"><strong>Oryginalna notatka</strong><p>{plan.originalTeacherNote}</p></div>}
      <div className="test-plan-note"><strong>Jak aplikacja ją zrozumiała</strong><p>{plan.interpretationSummary}</p></div>
      {taskTypes.length > 0 && <div className="test-plan-note"><strong>Spodziewane typy zadań</strong><p>{taskTypes.join(" · ")}</p></div>}
      {pageRanges.length > 0 && <div className="test-plan-note"><strong>Strony wskazane przez nauczyciela</strong><p>{pageRanges.map((range) => range.from === range.to ? `s. ${range.from}` : `s. ${range.from}–${range.to}`).join(" · ")}</p><small className="muted">Numery stron są zapisane, ale ostateczny zakres celów potwierdzasz poniżej.</small></div>}
    </section>
    <form action={confirmTestPlan.bind(null, unitId, plan.id)} className="stack">
      <section className="card">
        <h2>Sprawdź każde zagadnienie</h2>
        <p className="muted">To Twój wybór jest ostateczny. Niejasna notatka nie powinna automatycznie usuwać materiału.</p>
        <div className="test-plan-objectives">{objectives.map((row) => <article key={row.learningObjectiveId} className={`test-plan-objective scope-${row.suggestedScope.toLocaleLowerCase()}`}>
          <div><small>{row.learningObjective.topic.title}</small><strong>{row.learningObjective.title}</strong><p>{row.learningObjective.description}</p>{row.reason && <em>Sugestia: {row.reason}</em>}</div>
          <label><span>Status</span><select name={`scope:${row.learningObjectiveId}`} defaultValue={row.suggestedScope} required>{Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </article>)}</div>
      </section>
      <button className="button test-plan-confirm" type="submit">Zatwierdź zakres i rozpocznij diagnostykę</button>
    </form>
  </main>;
}
