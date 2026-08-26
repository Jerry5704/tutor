import Link from "next/link";
import { requireStudent } from "@/server/auth/session";
import { CurriculumService } from "@/server/services/curriculum-service";
import { db } from "@/server/db/client";
import { MockExamService } from "@/server/services/mock-exam-service";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { createTestPlanDraft, startMockExam, startUnit } from "./actions";

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const student = await requireStudent();
  const unit = await new CurriculumService().getUnitForStudent(unitId, student.id);
  const [existing, draft, confirmed] = await Promise.all([
    db.studySession.findFirst({
      where: { studentId: student.id, unitId, endedAt: null },
      include: { teacherScopeNote: true, testPlan: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.testPlan.findFirst({ where: { studentId: student.id, unitId, status: "DRAFT" }, orderBy: { updatedAt: "desc" } }),
    db.testPlan.findFirst({ where: { studentId: student.id, unitId, status: "CONFIRMED" }, orderBy: { confirmedAt: "desc" } }),
  ]);
  const mockAvailability = confirmed
    ? await new MockExamService(new OpenAIProvider()).availability(student.id, unitId)
    : null;
  const mockAction = mockAvailability?.available
    ? <form action={startMockExam.bind(null, unit.id)}><button type="submit" className="button secondary">Zrób próbny sprawdzian</button></form>
    : null;
  if (existing) return <main className="narrow"><p className="eyebrow">{unit.title}</p><h1>Wróć do swojej nauki</h1><p className="muted">Tutor zachował bieżący cel, mastery i historię rozmowy.</p>{existing.testPlan && <section className="card"><strong>Plan sprawdzianu</strong><p>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(existing.testPlan.testDate)} · {existing.testPlan.dailyMinutes} min nauki dziennie</p></section>}{!existing.testPlan && existing.teacherScopeNote && <section className="card"><strong>Zakres od nauczyciela</strong><p>{existing.teacherScopeNote.content}</p></section>}<div className="row"><form action={startUnit.bind(null, unit.id)}><button type="submit" className="button">Wznów naukę</button></form>{mockAction}</div></main>;

  if (draft) return <main className="narrow"><p className="eyebrow">{unit.title}</p><h1>Dokończ plan sprawdzianu</h1><p className="muted">Zakres nie zacznie obowiązywać, dopóki nie sprawdzisz i nie zatwierdzisz każdego zagadnienia.</p><Link className="button" href={`/units/${unitId}/test-plan`}>Sprawdź rozpoznany zakres</Link></main>;

  if (confirmed) return <main className="narrow"><p className="eyebrow">{unit.title}</p><h1>Plan jest gotowy</h1><section className="card stack"><div><strong>Data sprawdzianu</strong><p>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "long" }).format(confirmed.testDate)}</p></div><div><strong>Planowany czas</strong><p>{confirmed.dailyMinutes} min dziennie</p></div><div className="row"><form action={startUnit.bind(null, unit.id)}><button type="submit" className="button">Rozpocznij diagnostykę</button></form>{mockAction}</div>{mockAvailability && !mockAvailability.available && <p className="muted">Próbny sprawdzian pojawi się po przygotowaniu pełnego banku dla tego działu.</p>}</section></main>;

  const today = dateValue(new Date());
  return <main className="narrow"><p className="eyebrow">{unit.title}</p><h1>Zaplanuj sprawdzian</h1><p className="muted">Najpierw ustalimy rzeczywisty zakres. Zobaczysz interpretację notatki i zatwierdzisz ją przed diagnostyką.</p><form action={createTestPlanDraft.bind(null, unit.id)} className="card stack"><label className="field"><strong>Kiedy jest sprawdzian?</strong><input type="date" name="testDate" min={today} required /></label><label className="field"><strong>Ile minut dziennie możesz się uczyć?</strong><input type="number" name="dailyMinutes" min="5" max="180" step="5" defaultValue="20" required /></label><label className="field"><strong>Co nauczyciel powiedział o zakresie?</strong><span className="muted">Opcjonalnie: wykluczone punkty, priorytety i spodziewane typy zadań.</span><textarea name="teacherNote" maxLength={5000} placeholder="Np. bez punktu 4.3, szczególnie ważny mechanizm specjacji, będą zadania maturalne…" /></label><button type="submit" className="button">Przeanalizuj zakres</button></form></main>;
}
