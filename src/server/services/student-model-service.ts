import { db } from "@/server/db/client";
import { weightedReadiness } from "@/server/services/readiness-policy";

export class StudentModelService {
  async masteryMap(studentId: string, objectiveIds: string[]) {
    const rows = await db.studentMastery.findMany({ where: { studentId, learningObjectiveId: { in: objectiveIds } } });
    return new Map(rows.map((row) => [row.learningObjectiveId, row]));
  }

  async readiness(studentId: string, objectives: { id: string; importance: number }[]) {
    if (!objectives.length) return 0;
    const mastery = await this.masteryMap(studentId, objectives.map((item) => item.id));
    return weightedReadiness(objectives.map((objective) => ({
      importance: objective.importance,
      mastery: mastery.get(objective.id)?.mastery ?? 0,
    })));
  }

  async mastery(studentId: string, objectiveId: string) {
    return (await db.studentMastery.findUnique({
      where: { studentId_learningObjectiveId: { studentId, learningObjectiveId: objectiveId } },
    }))?.mastery ?? 0;
  }

  async weakestObjective<T extends { id: string; importance: number }>(
    studentId: string,
    objectives: T[],
    excludedId?: string,
  ) {
    const mastery = await this.masteryMap(studentId, objectives.map((item) => item.id));
    return objectives
      .filter((item) => item.id !== excludedId)
      .toSorted((a, b) => ((mastery.get(a.id)?.mastery ?? 0) - (mastery.get(b.id)?.mastery ?? 0)) || (b.importance - a.importance))[0];
  }

  async masteryGroups<T extends { id: string }>(studentId: string, objectives: T[]) {
    const mastery = await this.masteryMap(studentId, objectives.map((item) => item.id));
    return {
      strong: objectives.filter((item) => (mastery.get(item.id)?.mastery ?? 0) >= 0.6),
      developing: objectives.filter((item) => {
        const value = mastery.get(item.id)?.mastery ?? 0;
        return value >= 0.25 && value < 0.6;
      }),
      gaps: objectives.filter((item) => (mastery.get(item.id)?.mastery ?? 0) < 0.25),
    };
  }
}
