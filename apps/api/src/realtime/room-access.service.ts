import { Injectable } from '@nestjs/common';
import { CampusMap, parseRoom, roomKey, userHash } from '@tajriba/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { SocketIdentity } from './socket-auth.service';

export interface RoomGrant {
  key: string;
  map: CampusMap['id'];
  kind: 'campus' | 'study' | 'exam';
  refId: string | null;
  spectator: boolean;
  spawnIndex: number;
  /** may publish their microphone */
  publishes: boolean;
}

/** Who may enter which room. Default deny. */
@Injectable()
export class RoomAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async grant(who: SocketIdentity, room: string, spectate = false): Promise<RoomGrant | null> {
    const ref = parseRoom(room);
    if (!ref) return null;

    if (ref.kind === 'campus') {
      // The school courtyard is for students; the school's teachers may drop in. Parents, directors and admins may not.
      if (who.role !== 'STUDENT' && who.role !== 'TEACHER') return null;
      // each user prefers their own spawn point; the gateway moves them to a free one if it is taken
      return { key: roomKey(ref, who.schoolId), map: 'campus', kind: 'campus', refId: null, spectator: false, spawnIndex: userHash(who.userId), publishes: false };
    }

    if (ref.kind === 'study') {
      const s = await this.prisma.studySession.findUnique({
        where: { id: ref.id },
        include: { participants: { select: { userId: true } }, class: { select: { schoolId: true } } },
      });
      if (!s || s.class.schoolId !== who.schoolId) return null;
      const idx = s.participants.findIndex((p) => p.userId === who.userId);
      if (idx < 0 || who.role !== 'STUDENT') return null;
      // The host may wait in the room for the invite to be accepted; the invited classmate must accept first.
      if (s.status !== 'ACTIVE' && !(s.status === 'INVITED' && s.hostId === who.userId)) return null;
      return { key: roomKey(ref), map: 'study', kind: 'study', refId: s.id, spectator: false, spawnIndex: s.hostId === who.userId ? 0 : 1, publishes: true };
    }

    // exam attempt room
    const a = await this.prisma.examAttempt.findUnique({
      where: { id: ref.id },
      include: { exam: { select: { classId: true, schoolId: true } } },
    });
    if (!a || a.exam.schoolId !== who.schoolId) return null;
    if (spectate) {
      let allowed = who.role === 'DIRECTOR' || who.role === 'ADMIN';
      if (who.role === 'TEACHER') {
        allowed = !!(await this.prisma.classTeacher.findUnique({ where: { classId_teacherId: { classId: a.exam.classId, teacherId: who.userId } } }));
      }
      if (!allowed) return null;
      return { key: roomKey(ref), map: 'exam', kind: 'exam', refId: a.id, spectator: true, spawnIndex: 0, publishes: false };
    }
    if (who.role !== 'STUDENT' || a.studentId !== who.userId) return null;
    if (a.status !== 'NOT_STARTED' && a.status !== 'IN_PROGRESS') return null;
    return { key: roomKey(ref), map: 'exam', kind: 'exam', refId: a.id, spectator: false, spawnIndex: 0, publishes: true };
  }
}
