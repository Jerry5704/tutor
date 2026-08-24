CREATE TABLE "ConceptEvidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "learningObjectiveId" TEXT NOT NULL,
    "evidenceLevel" TEXT NOT NULL,
    "masteryBefore" DOUBLE PRECISION NOT NULL,
    "masteryAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConceptEvidence_conceptId_assessmentId_key" ON "ConceptEvidence"("conceptId", "assessmentId");
CREATE INDEX "ConceptEvidence_studentId_conceptId_createdAt_idx" ON "ConceptEvidence"("studentId", "conceptId", "createdAt");

ALTER TABLE "ConceptEvidence" ADD CONSTRAINT "ConceptEvidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptEvidence" ADD CONSTRAINT "ConceptEvidence_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptEvidence" ADD CONSTRAINT "ConceptEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptEvidence" ADD CONSTRAINT "ConceptEvidence_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
