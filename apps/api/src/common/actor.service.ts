import { ForbiddenException, Injectable } from '@nestjs/common';
import { Action, Actor, can, Resource, Target } from '@tajriba/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from './auth-context';

@Injectable()
export class ActorService {
  constructor(private readonly prisma: PrismaService) {}

  /** Builds the Actor (with class/child relations) for the active membership. Cached per request. */
  async actor(auth: AuthContext): Promise<Actor> {
    if (auth.actor) return auth.actor;
    const m = auth.active;
    if (!m) throw new ForbiddenException('No active school membership');
    const actor: Actor = { userId: auth.userId, role: m.role, schoolId: m.schoolId };
    if (m.role === 'TEACHER') {
      const rows = await this.prisma.classTeacher.findMany({
        where: { teacherId: auth.userId, class: { schoolId: m.schoolId } },
        select: { classId: true },
      });
      actor.classIdsTaught = rows.map((r) => r.classId);
    } else if (m.role === 'STUDENT') {
      const rows = await this.prisma.enrollment.findMany({
        where: { studentId: auth.userId, status: 'ACTIVE', class: { schoolId: m.schoolId } },
        select: { classId: true },
      });
      actor.classIdsEnrolled = rows.map((r) => r.classId);
    } else if (m.role === 'PARENT') {
      const links = await this.prisma.parentLink.findMany({
        where: { parentId: auth.userId, status: 'VERIFIED' },
        select: { studentId: true },
      });
      actor.childIds = links.map((l) => l.studentId);
      const enr = await this.prisma.enrollment.findMany({
        where: { studentId: { in: actor.childIds }, status: 'ACTIVE', class: { schoolId: m.schoolId } },
        select: { classId: true },
      });
      actor.childClassIds = [...new Set(enr.map((e) => e.classId))];
    }
    auth.actor = actor;
    return actor;
  }

  /** Throws 403 unless allowed. */
  async assert(auth: AuthContext, action: Action, resource: Resource, target: Target = {}): Promise<Actor> {
    const actor = await this.actor(auth);
    if (!can(actor, action, resource, target)) throw new ForbiddenException('You do not have access to this.');
    return actor;
  }

  async check(auth: AuthContext, action: Action, resource: Resource, target: Target = {}): Promise<boolean> {
    const actor = await this.actor(auth);
    return can(actor, action, resource, target);
  }
}
