ALTER TYPE "AIUsageFeature" ADD VALUE IF NOT EXISTS 'MOCK_EXAM_GRADING';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'MOCK_EXAM_STARTED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'MOCK_EXAM_ANSWER_SAVED';
ALTER TYPE "LearningEventType" ADD VALUE IF NOT EXISTS 'MOCK_EXAM_GRADED';
CREATE TYPE "MockExamStatus" AS ENUM ('IN_PROGRESS', 'GRADING', 'GRADED');

CREATE TABLE "MockExamAttempt" (
  "id" TEXT NOT NULL,
  "activeKey" TEXT,
  "studentId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "testPlanId" TEXT NOT NULL,
  "status" "MockExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "readinessBefore" INTEGER NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "score" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "percentage" INTEGER,
  "overallSummary" TEXT,
  "providerResponseId" TEXT,
  "model" TEXT,
  "promptVersion" TEXT NOT NULL,
  "latencyMs" INTEGER,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gradedAt" TIMESTAMP(3),
  CONSTRAINT "MockExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamQuestion" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "questionRubricId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "promptSnapshot" TEXT NOT NULL,
  "rubricSnapshot" JSONB NOT NULL,
  "maxPoints" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "MockExamQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamQuestionObjective" (
  "mockExamQuestionId" TEXT NOT NULL,
  "learningObjectiveId" TEXT NOT NULL,
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  CONSTRAINT "MockExamQuestionObjective_pkey" PRIMARY KEY ("mockExamQuestionId", "learningObjectiveId")
);

CREATE TABLE "MockExamAnswer" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "rating" "AssessmentRating",
  "feedback" TEXT,
  "sourceLocators" JSONB,
  "earnedPoints" DOUBLE PRECISION,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gradedAt" TIMESTAMP(3),
  CONSTRAINT "MockExamAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockExamCriterionResult" (
  "answerId" TEXT NOT NULL,
  "rubricCriterionId" TEXT NOT NULL,
  "status" "RubricCriterionStatus" NOT NULL,
  "evidence" TEXT NOT NULL,
  "awardedPoints" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "MockExamCriterionResult_pkey" PRIMARY KEY ("answerId", "rubricCriterionId")
);

CREATE TABLE "MockExamObjectiveResult" (
  "attemptId" TEXT NOT NULL,
  "learningObjectiveId" TEXT NOT NULL,
  "earnedPoints" DOUBLE PRECISION NOT NULL,
  "maxPoints" DOUBLE PRECISION NOT NULL,
  "percentage" INTEGER NOT NULL,
  CONSTRAINT "MockExamObjectiveResult_pkey" PRIMARY KEY ("attemptId", "learningObjectiveId")
);

ALTER TABLE "AIUsageEvent" ADD COLUMN "mockExamAttemptId" TEXT;

CREATE UNIQUE INDEX "MockExamAttempt_activeKey_key" ON "MockExamAttempt"("activeKey");
CREATE UNIQUE INDEX "MockExamAttempt_providerResponseId_key" ON "MockExamAttempt"("providerResponseId");
CREATE INDEX "MockExamAttempt_studentId_unitId_status_startedAt_idx" ON "MockExamAttempt"("studentId", "unitId", "status", "startedAt");
CREATE INDEX "MockExamAttempt_testPlanId_status_idx" ON "MockExamAttempt"("testPlanId", "status");
CREATE UNIQUE INDEX "MockExamQuestion_attemptId_order_key" ON "MockExamQuestion"("attemptId", "order");
CREATE INDEX "MockExamQuestion_questionVersionId_idx" ON "MockExamQuestion"("questionVersionId");
CREATE INDEX "MockExamQuestion_questionRubricId_idx" ON "MockExamQuestion"("questionRubricId");
CREATE INDEX "MockExamQuestionObjective_learningObjectiveId_idx" ON "MockExamQuestionObjective"("learningObjectiveId");
CREATE UNIQUE INDEX "MockExamAnswer_questionId_key" ON "MockExamAnswer"("questionId");
CREATE INDEX "MockExamCriterionResult_rubricCriterionId_idx" ON "MockExamCriterionResult"("rubricCriterionId");
CREATE INDEX "MockExamObjectiveResult_learningObjectiveId_percentage_idx" ON "MockExamObjectiveResult"("learningObjectiveId", "percentage");
CREATE INDEX "AIUsageEvent_mockExamAttemptId_feature_createdAt_idx" ON "AIUsageEvent"("mockExamAttemptId", "feature", "createdAt");

ALTER TABLE "MockExamAttempt" ADD CONSTRAINT "MockExamAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamAttempt" ADD CONSTRAINT "MockExamAttempt_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamAttempt" ADD CONSTRAINT "MockExamAttempt_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockExamQuestion" ADD CONSTRAINT "MockExamQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "MockExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamQuestion" ADD CONSTRAINT "MockExamQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockExamQuestion" ADD CONSTRAINT "MockExamQuestion_questionRubricId_fkey" FOREIGN KEY ("questionRubricId") REFERENCES "QuestionRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockExamQuestionObjective" ADD CONSTRAINT "MockExamQuestionObjective_mockExamQuestionId_fkey" FOREIGN KEY ("mockExamQuestionId") REFERENCES "MockExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamQuestionObjective" ADD CONSTRAINT "MockExamQuestionObjective_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockExamAnswer" ADD CONSTRAINT "MockExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MockExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamCriterionResult" ADD CONSTRAINT "MockExamCriterionResult_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "MockExamAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamCriterionResult" ADD CONSTRAINT "MockExamCriterionResult_rubricCriterionId_fkey" FOREIGN KEY ("rubricCriterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockExamObjectiveResult" ADD CONSTRAINT "MockExamObjectiveResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "MockExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MockExamObjectiveResult" ADD CONSTRAINT "MockExamObjectiveResult_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_mockExamAttemptId_fkey" FOREIGN KEY ("mockExamAttemptId") REFERENCES "MockExamAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
