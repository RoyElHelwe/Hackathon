import { Injectable } from '@nestjs/common';
import { CampusMap, CampusMapId, examHallMap, MAPS, parseRoom, roomKey } from '@tajriba/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { SocketIdentity } from './socket-auth.service';

export interface RoomGrant {
  key: string;
  /** the room name the client used ("campus", "exam:x", "hall:y") */
  name: string;
  map: CampusMapId;
  /** the map positions are kept inside (the hall is built per exam) */
  mapDef: CampusMap;
  kind: 'campus' | 'study' | 'exam' | 'hall';
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
      return { key: roomKey(ref, who.schoolId), name: room, map: 'campus', mapDef: MAPS.campus, kind: 'campus', refId: null, spectator: false, spawnIndex: 0, publishes: false };
    }

    if (ref.kind === 'study') {
      const s = await this.prisma.studySession.findUnique({
        where: { id: ref.id },
        include: { participants: { select: { userId: true } }, class: { select: { schoolId: true } } },
      });
      if (!s || s.class.schoolId !== who.schoolId) return null;
      if (s.status !== 'INVITED' && s.status !== 'ACTIVE') return null;
      const idx = s.participants.findIndex((p) => p.userId === who.userId);
      if (idx < 0 || who.role !== 'STUDENT') return null;
      return { key: roomKey(ref), name: room, map: 'study', mapDef: MAPS.study, kind: 'study', refId: s.id, spectator: false, spawnIndex: s.hostId === who.userId ? 0 : 1, publishes: true };
    }

    if (ref.kind === 'hall') {
      // The exam hall: the class's teachers (and the school's director/admins) walk between the students' rooms.
      const exam = await this.prisma.exam.findUnique({ where: { id: ref.id }, select: { id: true, schoolId: true, classId: true, attempts: { select: { roomIndex: true } } } });
      if (!exam || exam.schoolId !== who.schoolId) return null;
      if (!(await this.isStaffOf(who, exam.classId))) return null;
      return {
        key: roomKey(ref),
        name: room,
        map: 'hall',
        mapDef: examHallMap(exam.attempts.map((x) => x.roomIndex)),
        kind: 'hall',
        refId: null,
        spectator: false,
        spawnIndex: 0,
        publishes: false,
      };
    }

    // exam attempt room
    const a = await this.prisma.examAttempt.findUnique({
      where: { id: ref.id },
      include: { exam: { select: { classId: true, schoolId: true } } },
    });
    if (!a || a.exam.schoolId !== who.schoolId) return null;
    if (spectate) {
      if (!(await this.isStaffOf(who, a.exam.classId))) return null;
      return { key: roomKey(ref), name: room, map: 'exam', mapDef: MAPS.exam, kind: 'exam', refId: a.id, spectator: true, spawnIndex: 0, publishes: false };
    }
    if (who.role !== 'STUDENT' || a.studentId !== who.userId) return null;
    if (a.status !== 'NOT_STARTED' && a.status !== 'IN_PROGRESS') return null;
    return { key: roomKey(ref), name: room, map: 'exam', mapDef: MAPS.exam, kind: 'exam', refId: a.id, spectator: false, spawnIndex: 0, publishes: true };
  }

  /** A teacher of the class, or the school's director/admin. */
  private async isStaffOf(who: SocketIdentity, classId: string): Promise<boolean> {
    if (who.role === 'DIRECTOR' || who.role === 'ADMIN') return true;
    if (who.role !== 'TEACHER') return false;
    return !!(await this.prisma.classTeacher.findUnique({ where: { classId_teacherId: { classId, teacherId: who.userId } } }));
  }
}
