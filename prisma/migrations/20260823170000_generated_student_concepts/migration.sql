CREATE TYPE "ConceptOrigin" AS ENUM ('CURATED', 'AI_GENERATED');
CREATE TYPE "ConceptReviewStatus" AS ENUM ('APPROVED', 'PENDING_REVIEW', 'REJECTED');

ALTER TABLE "Concept"
ADD COLUMN "origin" "ConceptOrigin" NOT NULL DEFAULT 'CURATED',
ADD COLUMN "reviewStatus" "ConceptReviewStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "createdForStudentId" TEXT,
ADD COLUMN "sourceQuestion" TEXT;

CREATE INDEX "Concept_createdForStudentId_reviewStatus_idx" ON "Concept"("createdForStudentId", "reviewStatus");

ALTER TABLE "Concept"
ADD CONSTRAINT "Concept_createdForStudentId_fkey"
FOREIGN KEY ("createdForStudentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConceptSession" ADD COLUMN "parentConceptSessionId" TEXT;
CREATE INDEX "ConceptSession_parentConceptSessionId_status_idx" ON "ConceptSession"("parentConceptSessionId", "status");
ALTER TABLE "ConceptSession"
ADD CONSTRAINT "ConceptSession_parentConceptSessionId_fkey"
FOREIGN KEY ("parentConceptSessionId") REFERENCES "ConceptSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
