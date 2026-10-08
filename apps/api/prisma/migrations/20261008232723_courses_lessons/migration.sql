-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('MATERIAL', 'ASSIGNMENT');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('NOT_GAMIFIED', 'GAMIFYING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "sectionLabel" TEXT;

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" "LessonKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "materials" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "status" "LessonStatus" NOT NULL DEFAULT 'NOT_GAMIFIED',
    "gamifyError" TEXT,
    "contentChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSource" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "classroomItemId" TEXT NOT NULL,
    "classroomUrl" TEXT,

    CONSTRAINT "LessonSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_schoolId_subjectId_gradeLevel_key" ON "Course"("schoolId", "subjectId", "gradeLevel");

-- CreateIndex
CREATE INDEX "Lesson_courseId_position_idx" ON "Lesson"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_courseId_fingerprint_key" ON "Lesson"("courseId", "fingerprint");

-- CreateIndex
CREATE INDEX "LessonSource_lessonId_idx" ON "LessonSource"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSource_classId_classroomItemId_key" ON "LessonSource"("classId", "classroomItemId");

-- CreateIndex
CREATE INDEX "Class_courseId_idx" ON "Class"("courseId");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSource" ADD CONSTRAINT "LessonSource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSource" ADD CONSTRAINT "LessonSource_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Course per (school, subject, grade) already used by classes, then attach the classes.
INSERT INTO "Course" ("id", "schoolId", "subjectId", "gradeLevel")
SELECT 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24), x."schoolId", x."subjectId", x."gradeLevel"
FROM (
  SELECT DISTINCT c."schoolId", c."subjectId", c."gradeLevel"
  FROM "Class" c
  JOIN "Subject" s ON s."id" = c."subjectId" AND s."schoolId" = c."schoolId"
  WHERE c."subjectId" IS NOT NULL AND c."gradeLevel" BETWEEN 1 AND 12
) x
ON CONFLICT DO NOTHING;

UPDATE "Class" c
SET "courseId" = co."id"
FROM "Course" co
WHERE c."courseId" IS NULL
  AND co."schoolId" = c."schoolId"
  AND co."subjectId" = c."subjectId"
  AND co."gradeLevel" = c."gradeLevel";
