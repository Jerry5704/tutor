import Link from "next/link";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";

const featureLabels = {
  TUTOR_TURN: "Główny tutor",
  CONCEPT_TUTOR_TURN: "Nauka pojęcia",
  CONCEPT_GENERATION: "Tworzenie karty pojęcia",
  SIDE_CHAT: "Pytanie poboczne",
  QUICK_EXPLANATION: "Szybkie wyjaśnienie zdania",
} as const;

function money(value: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(value);
}

function integer(value: number) {
  return new Intl.NumberFormat("pl-PL").format(value);
}

export default async function UsagePage() {
  const student = await requireStudent();
  const [usage, events, feedback] = await Promise.all([
    db.aiUsageEvent.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } }),
    db.learningEvent.findMany({ where: { studentId: student.id }, select: { eventType: true, metadata: true } }),
    db.tutorResponseFeedback.findMany({ where: { studentId: student.id }, select: { rating: true } }),
  ]);
  const completed = usage.filter((event) => event.status === "COMPLETED");
  const totalCost = completed.reduce((sum, event) => sum + Number(event.estimatedCostUsd ?? 0), 0);
  const totalTokens = completed.reduce((sum, event) => sum + (event.totalTokens ?? (event.inputTokens ?? 0) + (event.outputTokens ?? 0)), 0);
  const pricedCount = completed.filter((event) => event.estimatedCostUsd !== null).length;
  const responseTimes = events
    .filter((event) => event.eventType === "ANSWER_SUBMITTED")
    .map((event) => Number((event.metadata as { responseTimeMs?: number } | null)?.responseTimeMs ?? 0))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const medianResponseMs = responseTimes.length ? responseTimes[Math.floor(responseTimes.length / 2)] : 0;
  const helpful = feedback.filter((item) => item.rating === "HELPFUL").length;
  const rows = Object.entries(featureLabels).map(([feature, label]) => {
    const featureUsage = completed.filter((event) => event.feature === feature);
    return {
      feature,
      label,
      calls: featureUsage.length,
      tokens: featureUsage.reduce((sum, event) => sum + (event.totalTokens ?? (event.inputTokens ?? 0) + (event.outputTokens ?? 0)), 0),
      latencyMs: featureUsage.length ? Math.round(featureUsage.reduce((sum, event) => sum + event.latencyMs, 0) / featureUsage.length) : 0,
      cost: featureUsage.reduce((sum, event) => sum + Number(event.estimatedCostUsd ?? 0), 0),
    };
  }).filter((row) => row.calls > 0);

  return <main className="shell">
    <div className="row"><div><p className="eyebrow">Obserwowalność</p><h1>Zużycie AI</h1></div><Link className="button secondary" href="/dashboard">Wróć do dashboardu</Link></div>
    <p className="muted">Koszt jest szacunkiem obliczonym z tokenów zwróconych przez OpenAI i stawek zapisanych przy każdym wywołaniu. Nie zawiera podatków, rabatów ani innych pozycji z faktury.</p>
    <section className="usage-summary">
      <div><span>Szacowany koszt</span><strong>{money(totalCost)}</strong></div>
      <div><span>Tokeny łącznie</span><strong>{integer(totalTokens)}</strong></div>
      <div><span>Wywołania AI</span><strong>{integer(completed.length)}</strong></div>
    </section>
    <section className="card usage-table-wrap">
      <h2>Koszt według funkcji</h2>
      {rows.length ? <table className="usage-table"><thead><tr><th>Funkcja</th><th>Wywołania</th><th>Tokeny</th><th>Śr. czas</th><th>Koszt</th></tr></thead><tbody>{rows.map((row) => <tr key={row.feature}><td>{row.label}</td><td>{integer(row.calls)}</td><td>{integer(row.tokens)}</td><td>{(row.latencyMs / 1000).toFixed(1)} s</td><td>{money(row.cost)}</td></tr>)}</tbody></table> : <p className="muted">Nowe dane pojawią się po pierwszej odpowiedzi AI wykonanej po wdrożeniu migracji.</p>}
    </section>
    <section className="card" style={{ marginTop: 18 }}>
      <h2>Sygnały użycia</h2>
      <ul className="usage-notes">
        <li>Odpowiedzi ucznia: {events.filter((event) => event.eventType === "ANSWER_SUBMITTED").length}</li>
        <li>Mediana czasu odpowiedzi: {medianResponseMs ? `${Math.round(medianResponseMs / 1000)} s` : "brak danych"}</li>
        <li>Przerwane / wznowione sesje: {events.filter((event) => event.eventType === "SESSION_PAUSED").length} / {events.filter((event) => event.eventType === "SESSION_RESUMED").length}</li>
        <li>Szybkie wyjaśnienia: {events.filter((event) => event.eventType === "QUICK_EXPLANATION_REQUESTED").length}</li>
        <li>Oceny „pomogło”: {feedback.length ? `${helpful} z ${feedback.length}` : "brak ocen"}</li>
      </ul>
      {pricedCount < completed.length && <p className="error">Dla {completed.length - pricedCount} wywołań brakowało skonfigurowanego cennika, więc nie weszły do sumy kosztów.</p>}
    </section>
  </main>;
}
