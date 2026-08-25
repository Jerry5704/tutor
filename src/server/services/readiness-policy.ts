export const OBJECTIVE_MASTERY_THRESHOLD = 0.78;

export function readinessValue(mastery: number) {
  const bounded = Math.max(0, Math.min(1, mastery));
  return bounded >= OBJECTIVE_MASTERY_THRESHOLD ? 1 : bounded;
}

export function weightedReadiness(objectives: Array<{ importance: number; mastery: number }>) {
  if (!objectives.length) return 0;
  const totalWeight = objectives.reduce((sum, objective) => sum + objective.importance, 0);
  if (totalWeight <= 0) return 0;
  const score = objectives.reduce(
    (sum, objective) => sum + readinessValue(objective.mastery) * objective.importance,
    0,
  );
  return Math.round((score / totalWeight) * 100);
}
