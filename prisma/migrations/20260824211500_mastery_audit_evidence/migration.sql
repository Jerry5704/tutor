ALTER TABLE "Assessment"
ADD COLUMN "proposedMasteryDelta" DOUBLE PRECISION;

ALTER TABLE "AssessmentObjective"
ADD COLUMN "masteryBefore" DOUBLE PRECISION,
ADD COLUMN "masteryAfter" DOUBLE PRECISION,
ADD COLUMN "confidenceBefore" DOUBLE PRECISION,
ADD COLUMN "confidenceAfter" DOUBLE PRECISION;

ALTER TABLE "ConceptAssessment"
ADD COLUMN "evidenceLevel" TEXT,
ADD COLUMN "conceptMasteryBefore" DOUBLE PRECISION,
ADD COLUMN "conceptMasteryAfter" DOUBLE PRECISION,
ADD COLUMN "latencyMs" INTEGER;
