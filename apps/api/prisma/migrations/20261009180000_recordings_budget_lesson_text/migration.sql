-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "contentText" TEXT;

-- CreateIndex
CREATE INDEX "Recording_schoolId_idx" ON "Recording"("schoolId");

-- CreateIndex
CREATE INDEX "Recording_startedAt_idx" ON "Recording"("startedAt");

