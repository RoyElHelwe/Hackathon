import type { PrismaClient } from '../generated/prisma/client';

/**
 * Director suite demo data: extra staff with subjects, timetable setup + rules + a published timetable, absences
 * and covers. Filled in by the timetable build; called at the end of seed().
 */
export async function seedSchoolOps(_prisma: PrismaClient, _ctx: { schoolId: string; directorId: string; users: Record<string, string>; subjects: Record<string, string>; now: Date }) {
  // timetable build fills this in
}
