ALTER TABLE "TutorMessage" ADD COLUMN "knowledgeAssetId" TEXT;

ALTER TABLE "TutorMessage"
ADD CONSTRAINT "TutorMessage_knowledgeAssetId_fkey"
FOREIGN KEY ("knowledgeAssetId") REFERENCES "KnowledgeAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TutorMessage_knowledgeAssetId_idx" ON "TutorMessage"("knowledgeAssetId");

UPDATE "TutorMessage" AS message
SET "knowledgeAssetId" = (
  SELECT candidate."id"
  FROM "KnowledgeAsset" AS candidate
  WHERE candidate."learningObjectiveId" = message."learningObjectiveId"
    AND candidate."status" = 'APPROVED'
  ORDER BY candidate."priority" ASC, candidate."createdAt" ASC
  LIMIT 1
)
WHERE message."showVisual" = true;
