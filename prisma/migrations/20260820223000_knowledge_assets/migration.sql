CREATE TABLE "KnowledgeAsset" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "learningObjectiveId" TEXT NOT NULL,
  "knowledgeSourceId" TEXT,
  "sourceType" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL DEFAULT 'image/png',
  "localFileName" TEXT,
  "externalUrl" TEXT,
  "sourcePage" INTEGER,
  "caption" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "attribution" TEXT NOT NULL,
  "rightsNote" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "status" "SourceStatus" NOT NULL DEFAULT 'DRAFT',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KnowledgeAsset_key_key" ON "KnowledgeAsset"("key");
CREATE INDEX "KnowledgeAsset_learningObjectiveId_status_priority_idx" ON "KnowledgeAsset"("learningObjectiveId", "status", "priority");
ALTER TABLE "KnowledgeAsset" ADD CONSTRAINT "KnowledgeAsset_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "LearningObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAsset" ADD CONSTRAINT "KnowledgeAsset_knowledgeSourceId_fkey" FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
