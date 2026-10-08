import { Injectable, NotFoundException } from '@nestjs/common';
import { levelForXp } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { ClassroomService } from '../classroom/classroom.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly classroom: ClassroomService,
  ) {}

  async mine(a: AuthContext) {
    const actor = await this.actors.actor(a);
    const where: Prisma.ClassWhereInput =
      actor.role === 'TEACHER'
        ? { id: { in: actor.classIdsTaught } }
        : actor.role === 'STUDENT'
          ? { id: { in: actor.classIdsEnrolled } }
          : actor.role === 'PARENT'
            ? { id: { in: actor.childClassIds } }
            : { schoolId: actor.schoolId };
    const classes = await this.prisma.class.findMany({
      where,
      include: {
        teachers: { include: { teacher: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } }, missions: { where: { status: 'APPROVED' } } } },
      },
      orderBy: { name: 'asc' },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      classroomCourseId: c.classroomCourseId,
      lastSyncedAt: c.lastSyncedAt,
      syncError: c.syncError,
      settings: c.settings,
      teachers: c.teachers.map((t) => ({ ...t.teacher, type: t.type })),
      studentCount: c._count.enrollments,
      missionCount: c._count.missions,
    }));
  }

  async get(a: AuthContext, id: string) {
    await this.actors.assert(a, 'read', 'class', { classId: id });
    const c = await this.prisma.class.findUnique({
      where: { id },
      include: { teachers: { include: { teacher: { select: { id: true, name: true, avatarUrl: true } } } }, school: true },
    });
    if (!c) throw new NotFoundException();
    return {
      id: c.id,
      name: c.name,
      gradeLevel: c.gradeLevel,
      classroomCourseId: c.classroomCourseId,
      lastSyncedAt: c.lastSyncedAt,
      syncError: c.syncError,
      settings: c.settings,
      school: { id: c.school.id, name: c.school.name },
      teachers: c.teachers.map((t) => ({ ...t.teacher, type: t.type })),
    };
  }

  async students(a: AuthContext, id: string) {
    await this.actors.assert(a, 'read', 'class', { classId: id });
    const actor = await this.actors.actor(a);
    const enr = await this.prisma.enrollment.findMany({
      where: { classId: id, ...(actor.role === 'STUDENT' || actor.role === 'PARENT' ? { status: 'ACTIVE' } : {}) },
      include: { student: { include: { childLinks: { where: { status: 'VERIFIED' }, include: { parent: { select: { id: true, name: true, email: true } } } } } } },
      orderBy: { student: { name: 'asc' } },
    });
    const ids = enr.map((e) => e.studentId);
    const xp = await this.prisma.xpEvent.groupBy({ by: ['studentId'], where: { studentId: { in: ids } }, _sum: { amount: true } });
    const mastered = await this.prisma.topicProgress.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, state: 'MASTERED' }, _count: true });
    const staff = actor.role !== 'STUDENT' && actor.role !== 'PARENT';
    return enr.map((e) => {
      const total = xp.find((x) => x.studentId === e.studentId)?._sum.amount ?? 0;
      return {
        id: e.studentId,
        name: staff ? e.student.name : e.student.name.split(' ')[0],
        avatarUrl: e.student.avatarUrl,
        status: staff ? e.student.status : undefined,
        enrollment: e.status,
        xp: staff ? total : undefined,
        level: levelForXp(total),
        mastered: mastered.find((m) => m.studentId === e.studentId)?._count ?? 0,
        parents: staff ? e.student.childLinks.map((l) => l.parent) : undefined,
      };
    });
  }

  async updateSettings(a: AuthContext, id: string, patch: Record<string, unknown>) {
    await this.actors.assert(a, 'write', 'class', { classId: id });
    const c = await this.prisma.class.findUniqueOrThrow({ where: { id } });
    const settings = { ...(c.settings as Record<string, unknown>), ...patch };
    await this.prisma.class.update({ where: { id }, data: { settings: settings as Prisma.InputJsonValue } });
    return { settings };
  }

  async sync(a: AuthContext, id: string) {
    await this.actors.assert(a, 'write', 'class', { classId: id });
    const creds = await this.classroom.credentials(a.userId);
    return this.classroom.syncClass(id, creds);
  }
}
