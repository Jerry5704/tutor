CREATE TYPE "TestPlanStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');
CREATE TYPE "TestObjectiveScope" AS ENUM ('INCLUDED', 'EXCLUDED', 'PRIORITY');
CREATE TYPE "TestObjectiveScopeSource" AS ENUM ('CURRICULUM', 'AI_SUGGESTION', 'STUDENT_CONFIRMED');

ALTER TYPE "AIUsageFeature" ADD VALUE 'TEST_SCOPE_PARSING';
ALTER TYPE "LearningEventType" ADD VALUE 'TEST_PLAN_DRAFTED';
ALTER TYPE "LearningEventType" ADD VALUE 'TEST_PLAN_CONFIRMED';

ALTER TABLE "AIUsageEvent" ALTER COLUMN "studySessionId" DROP NOT NULL;
ALTER TABLE "StudySession" ADD COLUMN "testPlanId" TEXT;

CREATE TABLE "TestPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "TestPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "testDate" TIMESTAMP(3) NOT NULL,
    "dailyMinutes" INTEGER NOT NULL,
    "originalTeacherNote" TEXT,
    "interpretationSummary" TEXT,
    "expectedTaskTypes" JSONB NOT NULL DEFAULT '[]',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestPlanObjective" (
    "testPlanId" TEXT NOT NULL,
    "learningObjectiveId" TEXT NOT NULL,
    "suggestedScope" "TestObjectiveScope" NOT NULL,
    "confirmedScope" "TestObjectiveScope",
    "source" "TestObjectiveScopeSource" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "TestPlanObjective_pkey" PRIMARY KEY ("testPlanId", "learningObjectiveId")
);

CREATE INDEX "StudySession_testPlanId_idx" ON "StudySession"("testPlanId");
CREATE INDEX "TestPlan_studentId_unitId_status_updatedAt_idx" ON "TestPlan"("studentId", "unitId", "status", "updatedAt");
CREATE INDEX "TestPlan_testDate_status_idx" ON "TestPlan"("testDate", "status");
CREATE INDEX "TestPlanObjective_learningObjectiveId_confirmedScope_idx" ON "TestPlanObjective"("learningObjectiveId", "confirmedScope");

ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestPlan" ADD CONSTRAINT "TestPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestPlan" ADD CONSTRAINT "TestPlan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestPlanObjective" ADD CONSTRAINT "TestPlanObjective_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestPlanObjective" ADD CONSTRAINT "TestPlanObjective_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
