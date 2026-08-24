ALTER TABLE "ConceptAssessment"
ADD COLUMN "learningObjectiveId" TEXT,
ADD COLUMN "objectiveMasteryBefore" DOUBLE PRECISION,
ADD COLUMN "objectiveMasteryAfter" DOUBLE PRECISION;

CREATE INDEX "ConceptAssessment_learningObjectiveId_idx" ON "ConceptAssessment"("learningObjectiveId");

ALTER TABLE "ConceptAssessment" ADD CONSTRAINT "ConceptAssessment_learningObjectiveId_fkey"
FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
