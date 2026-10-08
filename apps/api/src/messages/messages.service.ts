import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { PrismaService } from '../prisma/prisma.service';

export interface Contact {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'TEACHER' | 'PARENT';
  about: { studentId: string; studentName: string }[];
  unread: number;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
  ) {}

  /** Parents talk to their children's teachers; teachers talk to parents of their students. */
  async contacts(a: AuthContext): Promise<Contact[]> {
    const actor = await this.actors.actor(a);
    const map = new Map<string, Contact>();
    if (actor.role === 'PARENT') {
      const teachers = await this.prisma.classTeacher.findMany({
        where: { classId: { in: actor.childClassIds } },
        include: { teacher: true, class: { include: { enrollments: { where: { studentId: { in: actor.childIds } }, include: { student: true } } } } },
      });
      for (const t of teachers) {
        const c = map.get(t.teacherId) ?? { id: t.teacherId, name: t.teacher.name, avatarUrl: t.teacher.avatarUrl, role: 'TEACHER' as const, about: [], unread: 0 };
        for (const e of t.class.enrollments) if (!c.about.some((x) => x.studentId === e.studentId)) c.about.push({ studentId: e.studentId, studentName: e.student.name });
        map.set(t.teacherId, c);
      }
    } else if (actor.role === 'TEACHER') {
      const links = await this.prisma.parentLink.findMany({
        where: { status: 'VERIFIED', student: { enrollments: { some: { classId: { in: actor.classIdsTaught }, status: 'ACTIVE' } } } },
        include: { parent: true, student: true },
      });
      for (const l of links) {
        const c = map.get(l.parentId) ?? { id: l.parentId, name: l.parent.name, avatarUrl: l.parent.avatarUrl, role: 'PARENT' as const, about: [], unread: 0 };
        c.about.push({ studentId: l.studentId, studentName: l.student.name });
        map.set(l.parentId, c);
      }
    }
    const unread = await this.prisma.message.groupBy({ by: ['fromId'], where: { toId: a.userId, readAt: null }, _count: true });
    for (const u of unread) {
      const c = map.get(u.fromId);
      if (c) c.unread = u._count;
    }
    return [...map.values()];
  }

  private async assertContact(a: AuthContext, otherId: string) {
    const contacts = await this.contacts(a);
    if (!contacts.some((c) => c.id === otherId)) throw new ForbiddenException('You can only message your child’s teachers or your students’ parents.');
  }

  async thread(a: AuthContext, withId: string) {
    await this.assertContact(a, withId);
    const msgs = await this.prisma.message.findMany({
      where: { OR: [{ fromId: a.userId, toId: withId }, { fromId: withId, toId: a.userId }] },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    await this.prisma.message.updateMany({ where: { fromId: withId, toId: a.userId, readAt: null }, data: { readAt: new Date() } });
    return msgs.map((m) => ({ id: m.id, fromId: m.fromId, toId: m.toId, studentId: m.studentId, body: m.body, createdAt: m.createdAt, mine: m.fromId === a.userId }));
  }

  async send(a: AuthContext, body: { toId: string; studentId?: string; body: string }) {
    await this.assertContact(a, body.toId);
    const m = await this.prisma.message.create({ data: { fromId: a.userId, toId: body.toId, studentId: body.studentId, body: body.body } });
    return { id: m.id, fromId: m.fromId, toId: m.toId, body: m.body, createdAt: m.createdAt, mine: true };
  }
}
