CREATE TYPE "QuestionIntent" AS ENUM ('DIAGNOSTIC', 'PRACTICE', 'CORRECTION', 'TRANSFER', 'UNDERSTANDING_CHECK');

ALTER TABLE "TutorMessage"
ADD COLUMN "questionIntent" "QuestionIntent",
ADD COLUMN "questionFingerprint" TEXT;

CREATE INDEX "TutorMessage_sessionId_learningObjectiveId_questionIntent_idx"
ON "TutorMessage"("sessionId", "learningObjectiveId", "questionIntent");
