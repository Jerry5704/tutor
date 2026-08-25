export type ObjectiveScope = "INCLUDED" | "EXCLUDED" | "PRIORITY";

export function applyScopeRecommendations<T extends { id: string; code: string }>(
  objectives: T[],
  recommendations: Array<{ objectiveCode: string; scope: ObjectiveScope; reason: string }>,
) {
  const byCode = new Map(objectives.map((objective) => [objective.code, objective]));
  const accepted = new Map<string, { scope: ObjectiveScope; reason: string }>();
  for (const item of recommendations) {
    const objective = byCode.get(item.objectiveCode);
    if (!objective || accepted.has(objective.id)) continue;
    accepted.set(objective.id, { scope: item.scope, reason: item.reason });
  }
  return objectives.map((objective) => ({
    objective,
    scope: accepted.get(objective.id)?.scope ?? "INCLUDED" as const,
    reason: accepted.get(objective.id)?.reason,
    suggestedByAI: accepted.has(objective.id),
  }));
}

export function objectivesInTestScope<T extends { id: string; importance: number }>(
  objectives: T[],
  rows: Array<{ learningObjectiveId: string; confirmedScope: ObjectiveScope | null }>,
) {
  const scopes = new Map(rows.map((row) => [row.learningObjectiveId, row.confirmedScope]));
  return objectives
    .filter((objective) => scopes.has(objective.id) && scopes.get(objective.id) !== "EXCLUDED")
    .map((objective) => ({
      ...objective,
      importance: objective.importance * (scopes.get(objective.id) === "PRIORITY" ? 1.5 : 1),
    }))
    .toSorted((left, right) => Number(scopes.get(right.id) === "PRIORITY") - Number(scopes.get(left.id) === "PRIORITY"));
}
