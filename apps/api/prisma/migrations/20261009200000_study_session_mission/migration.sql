-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "missionId" TEXT;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
