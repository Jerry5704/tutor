ALTER TABLE "Concept"
ADD COLUMN "concreteExample" TEXT,
ADD COLUMN "checkQuestion" TEXT,
ADD COLUMN "transferQuestion" TEXT;

ALTER TABLE "ConceptMessage" ADD COLUMN "submissionId" TEXT;
CREATE UNIQUE INDEX "ConceptMessage_submissionId_key" ON "ConceptMessage"("submissionId");
