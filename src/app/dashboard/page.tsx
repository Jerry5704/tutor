import Link from "next/link";
import { requireStudent } from "@/server/auth/session";
import { CurriculumService } from "@/server/services/curriculum-service";
import { StudentModelService } from "@/server/services/student-model-service";
import { db } from "@/server/db/client";
import { objectivesInTestScope } from "@/server/services/test-plan-policy";

export default async function Dashboard() {
  const student = await requireStudent();
  const units = await new CurriculumService().listUnits(student.id);
  const model = new StudentModelService();
  const rows = await Promise.all(units.map(async (unit) => {
    const allObjectives = unit.topics.flatMap((topic) => topic.objectives);
    const plan = await db.testPlan.findFirst({
      where: { studentId: student.id, unitId: unit.id, status: "CONFIRMED" },
      orderBy: { confirmedAt: "desc" },
      include: { objectives: true },
    });
    const testObjectives = plan
      ? objectivesInTestScope(allObjectives, plan.objectives)
      : allObjectives;
    return {
      unit,
      plan,
      testReadiness: await model.readiness(student.id, testObjectives),
      unitReadiness: await model.readiness(student.id, allObjectives),
      testObjectiveCount: testObjectives.length,
    };
  }));

  return <main className="shell"><p className="eyebrow">Biologia · klasa IV · rozszerzenie</p><div className="row"><div><h1>Co dziś zrozumiemy?</h1><p className="muted">Gotowość pokazuje opanowanie materiału, nie przewidywaną ocenę.</p></div><div><span>Cześć, {student.displayName}</span><br /><Link className="muted" href="/usage">Zużycie AI i koszty →</Link></div></div><section className="stack">{rows.map(({ unit, plan, testReadiness, unitReadiness, testObjectiveCount }) => <article className="card" key={unit.id}><div className="row"><div><p className="eyebrow">Dział {unit.order}</p><h2>{unit.title}</h2><p className="muted">{unit.description}</p></div><strong>{testReadiness}%</strong></div><div className="progress" role="progressbar" aria-label="Gotowość do sprawdzianu" aria-valuenow={testReadiness} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${testReadiness}%` }} /></div><div className="readiness-breakdown"><span>{plan ? `Zakres sprawdzianu: ${testObjectiveCount} umiejętności` : "Plan sprawdzianu nieustalony"}</span><span>Cały dział: {unitReadiness}%</span></div><div className="row" style={{ marginTop: 16 }}><span className="muted">{plan ? `Sprawdzian ${new Intl.DateTimeFormat("pl-PL").format(plan.testDate)}` : `${unit.topics.flatMap((topic) => topic.objectives).length} umiejętności`}</span><Link className="button" href={`/units/${unit.id}`}>{plan ? "Kontynuuj przygotowanie" : "Zaplanuj sprawdzian"}</Link></div></article>)}</section></main>;
}
