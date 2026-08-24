CREATE TYPE "ConceptFamiliarity" AS ENUM ('UNKNOWN', 'NOT_FAMILIAR', 'SOMEWHAT_FAMILIAR', 'FAMILIAR');
CREATE TYPE "ConceptSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "ConceptSessionPhase" AS ENUM ('ORIENT', 'EXPLAIN', 'PRACTICE', 'CHECK');
CREATE TYPE "ConceptRelationType" AS ENUM ('PREREQUISITE', 'RELATED', 'PART_OF', 'CONTRASTS_WITH');

CREATE TABLE "Concept" (
  "id" TEXT NOT NULL,
  "curriculumVersionId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortDefinition" TEXT NOT NULL,
  "simpleExplanation" TEXT NOT NULL,
  "whyItMatters" TEXT NOT NULL,
  "commonMisconception" TEXT,
  "visualData" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptAlias" (
  "id" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  CONSTRAINT "ConceptAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptObjective" (
  "conceptId" TEXT NOT NULL,
  "learningObjectiveId" TEXT NOT NULL,
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  CONSTRAINT "ConceptObjective_pkey" PRIMARY KEY ("conceptId", "learningObjectiveId")
);

CREATE TABLE "ConceptRelation" (
  "sourceConceptId" TEXT NOT NULL,
  "targetConceptId" TEXT NOT NULL,
  "relationType" "ConceptRelationType" NOT NULL,
  CONSTRAINT "ConceptRelation_pkey" PRIMARY KEY ("sourceConceptId", "targetConceptId", "relationType")
);

CREATE TABLE "ConceptSource" (
  "conceptId" TEXT NOT NULL,
  "knowledgeChunkId" TEXT NOT NULL,
  CONSTRAINT "ConceptSource_pkey" PRIMARY KEY ("conceptId", "knowledgeChunkId")
);

CREATE TABLE "StudentConceptState" (
  "studentId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "selfFamiliarity" "ConceptFamiliarity" NOT NULL DEFAULT 'UNKNOWN',
  "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "lastPracticedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentConceptState_pkey" PRIMARY KEY ("studentId", "conceptId")
);

CREATE TABLE "ConceptSession" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "conceptId" TEXT NOT NULL,
  "parentStudySessionId" TEXT NOT NULL,
  "returnToMessageId" TEXT,
  "status" "ConceptSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "phase" "ConceptSessionPhase" NOT NULL DEFAULT 'ORIENT',
  "scaffoldLevel" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "ConceptSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptMessage" (
  "id" TEXT NOT NULL,
  "conceptSessionId" TEXT NOT NULL,
  "role" "MessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConceptMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConceptAssessment" (
  "id" TEXT NOT NULL,
  "conceptMessageId" TEXT NOT NULL,
  "rating" "AssessmentRating" NOT NULL,
  "masteryDelta" DOUBLE PRECISION NOT NULL,
  "rationale" TEXT NOT NULL,
  "providerResponseId" TEXT,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "knowledgeLocators" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConceptAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Concept_curriculumVersionId_slug_key" ON "Concept"("curriculumVersionId", "slug");
CREATE INDEX "Concept_curriculumVersionId_active_idx" ON "Concept"("curriculumVersionId", "active");
CREATE UNIQUE INDEX "ConceptAlias_conceptId_normalizedAlias_key" ON "ConceptAlias"("conceptId", "normalizedAlias");
CREATE INDEX "ConceptAlias_normalizedAlias_idx" ON "ConceptAlias"("normalizedAlias");
CREATE INDEX "ConceptObjective_learningObjectiveId_idx" ON "ConceptObjective"("learningObjectiveId");
CREATE INDEX "ConceptRelation_targetConceptId_relationType_idx" ON "ConceptRelation"("targetConceptId", "relationType");
CREATE INDEX "ConceptSource_knowledgeChunkId_idx" ON "ConceptSource"("knowledgeChunkId");
CREATE INDEX "StudentConceptState_studentId_mastery_idx" ON "StudentConceptState"("studentId", "mastery");
CREATE INDEX "ConceptSession_studentId_status_updatedAt_idx" ON "ConceptSession"("studentId", "status", "updatedAt");
CREATE INDEX "ConceptSession_parentStudySessionId_status_idx" ON "ConceptSession"("parentStudySessionId", "status");
CREATE INDEX "ConceptMessage_conceptSessionId_createdAt_idx" ON "ConceptMessage"("conceptSessionId", "createdAt");
CREATE UNIQUE INDEX "ConceptAssessment_conceptMessageId_key" ON "ConceptAssessment"("conceptMessageId");

ALTER TABLE "Concept" ADD CONSTRAINT "Concept_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptAlias" ADD CONSTRAINT "ConceptAlias_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptObjective" ADD CONSTRAINT "ConceptObjective_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptObjective" ADD CONSTRAINT "ConceptObjective_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptRelation" ADD CONSTRAINT "ConceptRelation_sourceConceptId_fkey" FOREIGN KEY ("sourceConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptRelation" ADD CONSTRAINT "ConceptRelation_targetConceptId_fkey" FOREIGN KEY ("targetConceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSource" ADD CONSTRAINT "ConceptSource_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSource" ADD CONSTRAINT "ConceptSource_knowledgeChunkId_fkey" FOREIGN KEY ("knowledgeChunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentConceptState" ADD CONSTRAINT "StudentConceptState_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentConceptState" ADD CONSTRAINT "StudentConceptState_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSession" ADD CONSTRAINT "ConceptSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSession" ADD CONSTRAINT "ConceptSession_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSession" ADD CONSTRAINT "ConceptSession_parentStudySessionId_fkey" FOREIGN KEY ("parentStudySessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptSession" ADD CONSTRAINT "ConceptSession_returnToMessageId_fkey" FOREIGN KEY ("returnToMessageId") REFERENCES "TutorMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConceptMessage" ADD CONSTRAINT "ConceptMessage_conceptSessionId_fkey" FOREIGN KEY ("conceptSessionId") REFERENCES "ConceptSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptAssessment" ADD CONSTRAINT "ConceptAssessment_conceptMessageId_fkey" FOREIGN KEY ("conceptMessageId") REFERENCES "ConceptMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
