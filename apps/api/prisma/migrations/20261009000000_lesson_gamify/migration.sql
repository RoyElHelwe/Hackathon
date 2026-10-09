-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "parentMissionId" TEXT;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "lessonId" TEXT;

-- CreateIndex
CREATE INDEX "Mission_courseId_status_idx" ON "Mission"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_parentMissionId_classId_key" ON "Mission"("parentMissionId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_lessonId_key" ON "Topic"("lessonId");

-- CreateIndex
CREATE INDEX "Topic_courseId_idx" ON "Topic"("courseId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_parentMissionId_fkey" FOREIGN KEY ("parentMissionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

