import { decrypt } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TeacherCredentials } from './classroom.provider';

/** Loads a teacher's Google credentials (decrypted refresh token, or null when never connected / undecryptable). */
export async function loadTeacherCredentials(prisma: PrismaService, userId: string): Promise<TeacherCredentials> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let refreshToken: string | null = null;
  if (u.googleRefreshToken) {
    try {
      refreshToken = decrypt(u.googleRefreshToken);
    } catch {
      refreshToken = null;
    }
  }
  return { userId: u.id, googleId: u.googleId, refreshToken };
}
