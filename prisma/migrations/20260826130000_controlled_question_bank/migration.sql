DO $$ BEGIN CREATE TYPE "QuestionPurpose" AS ENUM ('DIAGNOSTIC', 'PRACTICE', 'TRANSFER', 'REVIEW', 'MOCK_EXAM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QuestionFormat" AS ENUM ('OPEN_RESPONSE', 'SHORT_ANSWER', 'MULTIPLE_CHOICE', 'TABLE_OR_GRAPH', 'EXPERIMENT', 'DIAGRAM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RubricSourceType" AS ENUM ('CKE_EXACT', 'CKE_DERIVED', 'TEACHER_SPECIFIC', 'CURRICULUM_DERIVED', 'INTERNAL_LEARNING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RubricScoringMode" AS ENUM ('LEARNING_EVIDENCE', 'EXAM_POINTS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RubricCriterionStatus" AS ENUM ('MET', 'PARTIALLY_MET', 'NOT_MET', 'CONTRADICTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QuestionItemVersion" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "prompt" TEXT NOT NULL,
  "purpose" "QuestionPurpose" NOT NULL,
  "format" "QuestionFormat" NOT NULL DEFAULT 'OPEN_RESPONSE',
  "evidenceLevel" TEXT NOT NULL,
  "difficulty" INTEGER NOT NULL DEFAULT 1,
  "status" "SourceStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceType" "RubricSourceType" NOT NULL,
  "sourceLocator" TEXT,
  "sourceVersion" TEXT,
  "stimulus" JSONB,
  "expectedMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionItemVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QuestionObjective" (
  "questionVersionId" TEXT NOT NULL,
  "learningObjectiveId" TEXT NOT NULL,
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  CONSTRAINT "QuestionObjective_pkey" PRIMARY KEY ("questionVersionId", "learningObjectiveId")
);

CREATE TABLE IF NOT EXISTS "QuestionRubric" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "questionVersionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "sourceType" "RubricSourceType" NOT NULL,
  "scoringMode" "RubricScoringMode" NOT NULL,
  "status" "SourceStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceLocator" TEXT,
  "sourceVersion" TEXT,
  "testPlanId" TEXT,
  "maxPoints" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionRubric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RubricCriterion" (
  "id" TEXT NOT NULL,
  "questionRubricId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "points" DOUBLE PRECISION,
  "evidenceLevel" TEXT NOT NULL,
  "acceptedVariants" JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentCriterionResult" (
  "assessmentId" TEXT NOT NULL,
  "rubricCriterionId" TEXT NOT NULL,
  "status" "RubricCriterionStatus" NOT NULL,
  "evidence" TEXT NOT NULL,
  "awardedPoints" DOUBLE PRECISION,
  CONSTRAINT "AssessmentCriterionResult_pkey" PRIMARY KEY ("assessmentId", "rubricCriterionId")
);

ALTER TABLE "TutorMessage" ADD COLUMN IF NOT EXISTS "questionVersionId" TEXT;
ALTER TABLE "TutorMessage" ADD COLUMN IF NOT EXISTS "questionRubricId" TEXT;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "questionVersionId" TEXT;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "questionRubricId" TEXT;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "rubricEarnedPoints" DOUBLE PRECISION;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "rubricMaxPoints" DOUBLE PRECISION;

CREATE UNIQUE INDEX IF NOT EXISTS "QuestionItemVersion_stableKey_version_key" ON "QuestionItemVersion"("stableKey", "version");
CREATE INDEX IF NOT EXISTS "QuestionItemVersion_purpose_status_difficulty_idx" ON "QuestionItemVersion"("purpose", "status", "difficulty");
CREATE INDEX IF NOT EXISTS "QuestionObjective_learningObjectiveId_idx" ON "QuestionObjective"("learningObjectiveId");
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionRubric_stableKey_version_key" ON "QuestionRubric"("stableKey", "version");
CREATE INDEX IF NOT EXISTS "QuestionRubric_questionVersionId_status_idx" ON "QuestionRubric"("questionVersionId", "status");
CREATE INDEX IF NOT EXISTS "QuestionRubric_testPlanId_idx" ON "QuestionRubric"("testPlanId");
CREATE UNIQUE INDEX IF NOT EXISTS "RubricCriterion_questionRubricId_code_key" ON "RubricCriterion"("questionRubricId", "code");
CREATE INDEX IF NOT EXISTS "AssessmentCriterionResult_rubricCriterionId_idx" ON "AssessmentCriterionResult"("rubricCriterionId");
CREATE INDEX IF NOT EXISTS "TutorMessage_questionVersionId_idx" ON "TutorMessage"("questionVersionId");
CREATE INDEX IF NOT EXISTS "TutorMessage_questionRubricId_idx" ON "TutorMessage"("questionRubricId");
CREATE INDEX IF NOT EXISTS "Assessment_questionVersionId_idx" ON "Assessment"("questionVersionId");
CREATE INDEX IF NOT EXISTS "Assessment_questionRubricId_idx" ON "Assessment"("questionRubricId");

DO $$ BEGIN ALTER TABLE "QuestionObjective" ADD CONSTRAINT "QuestionObjective_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionItemVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QuestionObjective" ADD CONSTRAINT "QuestionObjective_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QuestionRubric" ADD CONSTRAINT "QuestionRubric_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionItemVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "QuestionRubric" ADD CONSTRAINT "QuestionRubric_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_questionRubricId_fkey" FOREIGN KEY ("questionRubricId") REFERENCES "QuestionRubric"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AssessmentCriterionResult" ADD CONSTRAINT "AssessmentCriterionResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AssessmentCriterionResult" ADD CONSTRAINT "AssessmentCriterionResult_rubricCriterionId_fkey" FOREIGN KEY ("rubricCriterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_questionRubricId_fkey" FOREIGN KEY ("questionRubricId") REFERENCES "QuestionRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_questionRubricId_fkey" FOREIGN KEY ("questionRubricId") REFERENCES "QuestionRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "QuestionItemVersion" (
  "id", "stableKey", "version", "prompt", "purpose", "format", "evidenceLevel", "difficulty",
  "status", "sourceType", "sourceLocator", "sourceVersion", "createdAt", "updatedAt"
)
SELECT "id" || ':diagnostic:v1', "code" || ':diagnostic', 1, "diagnosticPrompt", 'DIAGNOSTIC'::"QuestionPurpose", 'OPEN_RESPONSE'::"QuestionFormat", 'MECHANISM', 1,
  'APPROVED'::"SourceStatus", 'CURRICULUM_DERIVED'::"RubricSourceType", 'learning-objective:' || "code", 'baseline-v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "LearningObjective"
UNION ALL
SELECT "id" || ':practice:v1', "code" || ':practice', 1, "practicePrompt", 'PRACTICE'::"QuestionPurpose", 'OPEN_RESPONSE'::"QuestionFormat", 'MECHANISM', 2,
  'APPROVED'::"SourceStatus", 'INTERNAL_LEARNING'::"RubricSourceType", 'learning-objective:' || "code", 'baseline-v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "LearningObjective"
UNION ALL
SELECT "id" || ':transfer:v1', "code" || ':transfer', 1, "transferPrompt", 'TRANSFER'::"QuestionPurpose", 'OPEN_RESPONSE'::"QuestionFormat", 'TRANSFER', 3,
  'APPROVED'::"SourceStatus", 'INTERNAL_LEARNING'::"RubricSourceType", 'learning-objective:' || "code", 'baseline-v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "LearningObjective"
ON CONFLICT ("stableKey", "version") DO NOTHING;

INSERT INTO "QuestionObjective" ("questionVersionId", "learningObjectiveId", "importance")
SELECT q."id", lo."id", 1
FROM "LearningObjective" lo
JOIN "QuestionItemVersion" q ON q."stableKey" IN (lo."code" || ':diagnostic', lo."code" || ':practice', lo."code" || ':transfer')
ON CONFLICT ("questionVersionId", "learningObjectiveId") DO NOTHING;

INSERT INTO "QuestionRubric" (
  "id", "stableKey", "questionVersionId", "version", "title", "sourceType", "scoringMode", "status",
  "sourceLocator", "sourceVersion", "maxPoints", "createdAt", "updatedAt"
)
SELECT q."id" || ':rubric:v1', q."stableKey" || ':rubric', q."id", 1,
  'Kryteria opanowania celu', q."sourceType", 'LEARNING_EVIDENCE', 'APPROVED', q."sourceLocator", q."sourceVersion", 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "QuestionItemVersion" q
ON CONFLICT ("stableKey", "version") DO NOTHING;

INSERT INTO "RubricCriterion" (
  "id", "questionRubricId", "code", "description", "required", "points", "evidenceLevel", "acceptedVariants"
)
SELECT r."id" || ':answers-asked-question', r."id", 'answers_asked_question',
  'Odpowiedź poprawnie i rzeczowo realizuje wszystkie elementy polecenia: ' || q."prompt",
  true, 1, q."evidenceLevel", '[]'
FROM "QuestionRubric" r
JOIN "QuestionItemVersion" q ON q."id" = r."questionVersionId"
JOIN "QuestionObjective" qo ON qo."questionVersionId" = q."id"
JOIN "LearningObjective" lo ON lo."id" = qo."learningObjectiveId"
ON CONFLICT ("questionRubricId", "code") DO NOTHING;
