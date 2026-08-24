ALTER TABLE "User" ADD COLUMN "isSynthetic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_isSynthetic_idx" ON "User"("isSynthetic");
