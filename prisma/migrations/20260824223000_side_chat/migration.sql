-- CreateTable
CREATE TABLE "SideChatMessage" (
    "id" TEXT NOT NULL,
    "studySessionId" TEXT NOT NULL,
    "submissionId" TEXT,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "learningObjectiveId" TEXT,
    "linkedConceptId" TEXT,
    "sourceLocators" JSONB,
    "providerResponseId" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SideChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SideChatMessage_submissionId_key" ON "SideChatMessage"("submissionId");
CREATE INDEX "SideChatMessage_studySessionId_createdAt_idx" ON "SideChatMessage"("studySessionId", "createdAt");
CREATE INDEX "SideChatMessage_linkedConceptId_idx" ON "SideChatMessage"("linkedConceptId");

ALTER TABLE "SideChatMessage" ADD CONSTRAINT "SideChatMessage_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SideChatMessage" ADD CONSTRAINT "SideChatMessage_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SideChatMessage" ADD CONSTRAINT "SideChatMessage_linkedConceptId_fkey" FOREIGN KEY ("linkedConceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;
