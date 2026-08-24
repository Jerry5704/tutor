import Link from "next/link";
import { requireStudent } from "@/server/auth/session";
import { CurriculumService } from "@/server/services/curriculum-service";
import { StudentModelService } from "@/server/services/student-model-service";

export default async function Dashboard() {
  const student = await requireStudent(); const units = await new CurriculumService().listUnits(student.id); const model = new StudentModelService();
  const rows = await Promise.all(units.map(async (unit) => ({ unit, readiness: await model.readiness(student.id, unit.topics.flatMap((t) => t.objectives)) })));
  return <main className="shell"><p className="eyebrow">Biologia · klasa IV · rozszerzenie</p><div className="row"><div><h1>Co dziś zrozumiemy?</h1><p className="muted">Gotowość pokazuje opanowanie materiału, nie przewidywaną ocenę.</p></div><span>Cześć, {student.displayName}</span></div><section className="stack">{rows.map(({ unit, readiness }) => <article className="card" key={unit.id}><div className="row"><div><p className="eyebrow">Dział {unit.order}</p><h2>{unit.title}</h2><p className="muted">{unit.description}</p></div><strong>{readiness}%</strong></div><div className="progress" role="progressbar" aria-label="Gotowość" aria-valuenow={readiness} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${readiness}%` }} /></div><div className="row" style={{marginTop:16}}><span className="muted">{unit.topics.flatMap((t)=>t.objectives).length} umiejętności</span><Link className="button" href={`/units/${unit.id}`}>Przygotuj mnie do sprawdzianu</Link></div></article>)}</section></main>;
}
