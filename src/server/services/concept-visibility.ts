export function visibleConceptsFor(studentId: string) {
  return {
    OR: [
      { origin: "CURATED" as const },
      { origin: "AI_GENERATED" as const, createdForStudentId: studentId },
    ],
  };
}
