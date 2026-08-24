ALTER TABLE "ConceptAssessment"
ADD COLUMN "questionIntent" "QuestionIntent",
ADD COLUMN "questionFingerprint" TEXT;

DROP INDEX "ConceptAssessment_learningObjectiveId_idx";
CREATE INDEX "ConceptAssessment_learningObjectiveId_questionIntent_idx"
ON "ConceptAssessment"("learningObjectiveId", "questionIntent");
