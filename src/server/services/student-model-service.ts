import { db } from "@/server/db/client";

export class StudentModelService {
  async masteryMap(studentId: string, objectiveIds: string[]) {
    const rows = await db.studentMastery.findMany({ where: { studentId, learningObjectiveId: { in: objectiveIds } } });
    return new Map(rows.map((row) => [row.learningObjectiveId, row]));
  }

  async readiness(studentId: string, objectives: { id: string; importance: number }[]) {
    if (!objectives.length) return 0;
    const mastery = await this.masteryMap(studentId, objectives.map((item) => item.id));
    const weights = objectives.reduce((sum, item) => sum + item.importance, 0);
    const score = objectives.reduce((sum, item) => sum + (mastery.get(item.id)?.mastery ?? 0) * item.importance, 0);
    return Math.round((score / weights) * 100);
  }
}
