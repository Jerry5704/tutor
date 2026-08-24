-- Track diagnostic and learning progress per objective within a study session.
CREATE TYPE "SessionObjectiveStatus" AS ENUM ('NOT_STARTED', 'DIAGNOSING', 'LEARNING', 'MASTERED');

CREATE TABLE "SessionObjectiveState" (
    "sessionId" TEXT NOT NULL,
    "learningObjectiveId" TEXT NOT NULL,
    "status" "SessionObjectiveStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "diagnosticAttempts" INTEGER NOT NULL DEFAULT 0,
    "practicedAttempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionObjectiveState_pkey" PRIMARY KEY ("sessionId", "learningObjectiveId")
);

CREATE INDEX "SessionObjectiveState_sessionId_status_idx" ON "SessionObjectiveState"("sessionId", "status");

ALTER TABLE "SessionObjectiveState" ADD CONSTRAINT "SessionObjectiveState_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionObjectiveState" ADD CONSTRAINT "SessionObjectiveState_learningObjectiveId_fkey"
FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
