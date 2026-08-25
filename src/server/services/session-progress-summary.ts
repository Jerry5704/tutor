import { OBJECTIVE_MASTERY_THRESHOLD } from "@/server/services/readiness-policy";

type ObjectiveStatus = "NOT_STARTED" | "DIAGNOSING" | "LEARNING" | "MASTERED";

export type SessionProgressObjective = {
  id: string;
  title: string;
  status: ObjectiveStatus;
  mastery: number;
};

export type SessionProgressItem = SessionProgressObjective & { masteryPercent: number };

function progressItem(objective: SessionProgressObjective): SessionProgressItem {
  const mastery = Math.max(0, Math.min(1, objective.mastery));
  return { ...objective, mastery, masteryPercent: Math.round(mastery * 100) };
}

export function sessionProgressSummary(objectives: SessionProgressObjective[]) {
  const summary = {
    mastered: [] as SessionProgressItem[],
    developing: [] as SessionProgressItem[],
    remaining: [] as SessionProgressItem[],
  };

  for (const objective of objectives) {
    const item = progressItem(objective);
    if (item.status === "MASTERED" || item.mastery >= OBJECTIVE_MASTERY_THRESHOLD) {
      summary.mastered.push(item);
    } else if (item.status !== "NOT_STARTED" || item.mastery > 0) {
      summary.developing.push(item);
    } else {
      summary.remaining.push(item);
    }
  }

  summary.mastered.sort((a, b) => b.mastery - a.mastery);
  summary.developing.sort((a, b) => b.mastery - a.mastery);
  return summary;
}
