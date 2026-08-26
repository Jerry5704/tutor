import Link from "next/link";
import { notFound } from "next/navigation";
import { MockExamTimer } from "@/components/mock-exam-timer";
import { MockExamGradingRefresh } from "@/components/mock-exam-grading-refresh";
import { requireStudent } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { MOCK_REMEDIATION_THRESHOLD } from "@/server/services/mock-exam-policy";
import { StudentModelService } from "@/server/services/student-model-service";
import { objectivesInTestScope } from "@/server/services/test-plan-policy";
import { gradeMockExam, saveMockAnswer, startMockRemediation } from "./actions";

export default async function MockExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const student = await requireStudent();
  const attempt = await db.mockExamAttempt.findFirst({
    where: { id: attemptId, studentId: student.id },
    include: {
      unit: true,
      testPlan: { include: { objectives: { include: { learningObjective: true } } } },
      questions: {
        orderBy: { order: "asc" },
        include: {
          answer: { include: { criterionResults: { include: { rubricCriterion: true } } } },
          objectives: { include: { learningObjective: true } },
        },
      },
      objectiveResults: { include: { learningObjective: true }, orderBy: { learningObjective: { order: "asc" } } },
    },
  });
  if (!attempt) notFound();

  if (attempt.status === "GRADED") {
    const hasGaps = attempt.objectiveResults.some((result) => result.percentage < MOCK_REMEDIATION_THRESHOLD);
    const scopedObjectives = objectivesInTestScope(
      attempt.testPlan.objectives.map((row) => row.learningObjective),
      attempt.testPlan.objectives,
    );
    const currentReadiness = await new StudentModelService().testReadiness(student.id, attempt.testPlanId, scopedObjectives);
    return <main className="narrow mock-exam-page">
      <p className="eyebrow">Próbny sprawdzian zakończony</p>
      <h1>{attempt.unit.title}</h1>
      <section className="card mock-result">
        <div className="mock-score"><strong>{attempt.score}/{attempt.maxScore}</strong><span>{attempt.percentage}% punktów</span></div>
        <p>{attempt.overallSummary}</p>
        <p className="muted">To wynik tego podejścia, a nie gwarancja oceny na szkolnym sprawdzianie.</p>
        <div className="mock-readiness-comparison"><span>Przed sprawdzianem: <strong>{attempt.readinessBefore}%</strong></span><span>Gotowość po niezależnym sprawdzeniu: <strong>{currentReadiness}%</strong></span></div>
      </section>
      <section className="card stack">
        <h2>Wynik według umiejętności</h2>
        {attempt.objectiveResults.map((result) => <div className="mock-objective-result" key={result.learningObjectiveId}>
          <span>{result.learningObjective.title}</span><strong>{result.earnedPoints}/{result.maxPoints} · {result.percentage}%</strong>
        </div>)}
      </section>
      <section className="stack">
        <h2>Analiza odpowiedzi</h2>
        {attempt.questions.map((question) => <details className="card mock-answer-review" key={question.id}>
          <summary><span>Zadanie {question.order}</span><strong>{question.answer?.earnedPoints ?? 0}/{question.maxPoints} pkt</strong></summary>
          <p><strong>Pytanie:</strong> {question.promptSnapshot}</p>
          <p><strong>Twoja odpowiedź:</strong> {question.answer?.content || "Brak odpowiedzi"}</p>
          <p>{question.answer?.feedback}</p>
          <ul>{question.answer?.criterionResults.map((criterion) => <li className={criterion.status === "MET" ? "criterion-met" : "criterion-missed"} key={criterion.rubricCriterionId}>
            <span>{criterion.status === "MET" ? "✓" : criterion.status === "PARTIALLY_MET" ? "◐" : "!"} {criterion.rubricCriterion.description}</span>
            <strong>{criterion.awardedPoints}/{criterion.rubricCriterion.points ?? 0}</strong>
          </li>)}</ul>
        </details>)}
      </section>
      <div className="row">{hasGaps && <form action={startMockRemediation.bind(null, attempt.id)}><button type="submit" className="button">Ucz mnie tylko wykrytych braków</button></form>}<Link className="button secondary" href="/dashboard">Dashboard</Link></div>
    </main>;
  }

  const current = attempt.questions.find((question) => !question.answer);
  const answered = attempt.questions.filter((question) => question.answer).length;
  const expired = attempt.expiresAt <= new Date();
  return <main className="narrow mock-exam-page">
    <div className="row mock-exam-header">
      <div><p className="eyebrow">Próbny sprawdzian</p><h2>{attempt.unit.title}</h2></div>
      {attempt.status === "IN_PROGRESS" && !expired && <MockExamTimer expiresAt={attempt.expiresAt.toISOString()} />}
    </div>
    <div className="progress" role="progressbar" aria-label="Postęp sprawdzianu" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={attempt.questions.length}><span style={{ width: `${(answered / attempt.questions.length) * 100}%` }} /></div>
    <p className="muted">Odpowiedziano: {answered} z {attempt.questions.length}. Podpowiedzi i feedback pojawią się dopiero po oddaniu całości.</p>
    {attempt.status === "GRADING" && <section className="card"><MockExamGradingRefresh /><h2>Oceniam odpowiedzi…</h2><p className="muted">Wszystkie pytania są oceniane razem według zapisanych rubryk.</p></section>}
    {attempt.status === "IN_PROGRESS" && !expired && current && <section className="card mock-question">
      <div className="row"><span>Zadanie {current.order} z {attempt.questions.length}</span><strong>{current.maxPoints} pkt</strong></div>
      <h1>{current.promptSnapshot}</h1>
      <form action={saveMockAnswer.bind(null, attempt.id)} className="stack">
        <input type="hidden" name="questionId" value={current.id} />
        <label className="field"><span className="muted">Odpowiedź własnymi słowami</span><textarea name="answer" minLength={1} maxLength={10_000} required /></label>
        <button type="submit" className="button">Zapisz i przejdź dalej</button>
      </form>
    </section>}
    {attempt.status === "IN_PROGRESS" && (expired || !current) && <section className="card stack">
      <h2>{expired ? "Czas minął" : "Wszystkie odpowiedzi są zapisane"}</h2>
      <p className="muted">Po oddaniu nie będzie można zmienić odpowiedzi w tym podejściu.</p>
      <form action={gradeMockExam.bind(null, attempt.id)}><button type="submit" className="button">Oddaj sprawdzian do oceny</button></form>
    </section>}
    {attempt.status === "IN_PROGRESS" && !expired && current && <details className="card mock-finish-early"><summary>Zakończ wcześniej</summary><p className="muted">Nieudzielone odpowiedzi otrzymają zero punktów.</p><form action={gradeMockExam.bind(null, attempt.id)}><button type="submit" className="button secondary">Oddaj teraz</button></form></details>}
  </main>;
}
