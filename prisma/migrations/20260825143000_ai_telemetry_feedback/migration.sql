CREATE TYPE "AIUsageFeature" AS ENUM ('TUTOR_TURN', 'CONCEPT_TUTOR_TURN', 'CONCEPT_GENERATION', 'SIDE_CHAT', 'QUICK_EXPLANATION');
CREATE TYPE "AIUsageStatus" AS ENUM ('COMPLETED', 'FAILED');
CREATE TYPE "TutorFeedbackTarget" AS ENUM ('STUDY_MESSAGE', 'CONCEPT_MESSAGE', 'SIDE_CHAT_MESSAGE');
CREATE TYPE "TutorFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');
CREATE TYPE "LearningEventType" AS ENUM ('SESSION_STARTED', 'SESSION_RESUMED', 'SESSION_PAUSED', 'SESSION_COMPLETED', 'ANSWER_SUBMITTED', 'DIAGNOSTIC_SKIPPED', 'SIDE_QUESTION_SUBMITTED', 'QUICK_EXPLANATION_REQUESTED', 'CONCEPT_OPENED', 'TUTOR_FEEDBACK_SUBMITTED');

CREATE TABLE "AIUsageEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studySessionId" TEXT NOT NULL,
    "conceptSessionId" TEXT,
    "feature" "AIUsageFeature" NOT NULL,
    "status" "AIUsageStatus" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "providerResponseId" TEXT,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "reasoningOutputTokens" INTEGER,
    "totalTokens" INTEGER,
    "inputUsdPerMillion" DECIMAL(12,6),
    "cachedInputUsdPerMillion" DECIMAL(12,6),
    "outputUsdPerMillion" DECIMAL(12,6),
    "estimatedCostUsd" DECIMAL(14,8),
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TutorResponseFeedback" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetType" "TutorFeedbackTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" "TutorFeedbackRating" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorResponseFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "deduplicationKey" TEXT,
    "studentId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "learningObjectiveId" TEXT,
    "eventType" "LearningEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIUsageEvent_providerResponseId_key" ON "AIUsageEvent"("providerResponseId");
CREATE INDEX "AIUsageEvent_studentId_createdAt_idx" ON "AIUsageEvent"("studentId", "createdAt");
CREATE INDEX "AIUsageEvent_studySessionId_feature_createdAt_idx" ON "AIUsageEvent"("studySessionId", "feature", "createdAt");
CREATE INDEX "AIUsageEvent_feature_status_createdAt_idx" ON "AIUsageEvent"("feature", "status", "createdAt");
CREATE UNIQUE INDEX "TutorResponseFeedback_studentId_targetType_targetId_key" ON "TutorResponseFeedback"("studentId", "targetType", "targetId");
CREATE INDEX "TutorResponseFeedback_targetType_targetId_idx" ON "TutorResponseFeedback"("targetType", "targetId");
CREATE INDEX "TutorResponseFeedback_rating_createdAt_idx" ON "TutorResponseFeedback"("rating", "createdAt");
CREATE INDEX "LearningEvent_studentId_eventType_createdAt_idx" ON "LearningEvent"("studentId", "eventType", "createdAt");
CREATE INDEX "LearningEvent_studySessionId_createdAt_idx" ON "LearningEvent"("studySessionId", "createdAt");
CREATE INDEX "LearningEvent_learningObjectiveId_eventType_idx" ON "LearningEvent"("learningObjectiveId", "eventType");
CREATE UNIQUE INDEX "LearningEvent_deduplicationKey_key" ON "LearningEvent"("deduplicationKey");

ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_conceptSessionId_fkey" FOREIGN KEY ("conceptSessionId") REFERENCES "ConceptSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TutorResponseFeedback" ADD CONSTRAINT "TutorResponseFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
