import type { PrismaClient } from '../generated/prisma/client';

/** Families demo data for the director's Parents page (pending invites, last-seen times). Filled in by the parents build. */
export async function seedFamiliesOps(_prisma: PrismaClient, _ctx: { schoolId: string; users: Record<string, string>; now: Date }) {
  // parents build fills this in
}
