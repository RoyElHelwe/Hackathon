-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "subjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "TeacherSubject" (
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("teacherId","subjectId")
);

-- CreateIndex
CREATE INDEX "TeacherSubject_schoolId_idx" ON "TeacherSubject"("schoolId");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A subject's skills carry student work (missions → submissions, topic progress): never cascade a subject delete into them.
-- DropForeignKey
ALTER TABLE "Topic" DROP CONSTRAINT "Topic_subjectId_fkey";

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: databases seeded before this migration (the demo school TRP-2036) keep working without a manual re-seed.
-- No-ops on an empty database.
UPDATE "Subject" SET "schoolId" = (SELECT "id" FROM "School" WHERE "schoolCode" = 'TRP-2036')
  WHERE "schoolId" IS NULL AND EXISTS (SELECT 1 FROM "School" WHERE "schoolCode" = 'TRP-2036');

UPDATE "Class" SET "subjectId" = (SELECT "id" FROM "Subject" WHERE "key" = 'math')
  WHERE "subjectId" IS NULL
    AND "schoolId" = (SELECT "id" FROM "School" WHERE "schoolCode" = 'TRP-2036')
    AND EXISTS (SELECT 1 FROM "Subject" WHERE "key" = 'math');

INSERT INTO "TeacherSubject" ("teacherId", "schoolId", "subjectId")
  SELECT u."id", s."schoolId", s."id"
  FROM "User" u JOIN "Subject" s ON s."key" = 'math'
  WHERE u."devHandle" IN ('rana', 'hassan') AND s."schoolId" IS NOT NULL
  ON CONFLICT DO NOTHING;
