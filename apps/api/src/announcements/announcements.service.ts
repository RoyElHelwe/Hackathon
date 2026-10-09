import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AnnouncementAudienceKey } from '@tajriba/shared';
import type { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudienceKey;
  gradeLevel?: number | null;
  /** section letter ("B") or full key ("8B") */
  section?: string | null;
  includeParents?: boolean;
}

export interface AnnouncementRecipients {
  students: string[];
  teachers: string[];
  parents: string[];
  staff: string[];
}

/** School announcements: resolve who receives them, store them, notify everyone (in-app + live). */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly notifications: NotificationsService,
    private readonly bus: RealtimeBus,
  ) {}

  /** Who an announcement reaches (ids per group). Never includes the author. */
  async recipients(schoolId: string, input: AnnouncementInput, authorId?: string): Promise<AnnouncementRecipients> {
    const members = (role: 'STUDENT' | 'TEACHER' | 'PARENT' | 'DIRECTOR' | 'ADMIN') =>
      this.prisma.membership.findMany({ where: { schoolId, role, status: 'APPROVED' }, select: { userId: true } }).then((r) => r.map((m) => m.userId));
    const parentsOf = async (studentIds: string[]) =>
      studentIds.length
        ? [...new Set((await this.prisma.parentLink.findMany({ where: { studentId: { in: studentIds }, status: 'VERIFIED' }, select: { parentId: true } })).map((l) => l.parentId))]
        : [];
    const out: AnnouncementRecipients = { students: [], teachers: [], parents: [], staff: [] };
    switch (input.audience) {
      case 'SCHOOL':
        out.students = await members('STUDENT');
        out.teachers = await members('TEACHER');
        out.parents = await members('PARENT');
        out.staff = [...(await members('DIRECTOR')), ...(await members('ADMIN'))];
        break;
      case 'STUDENTS':
        out.students = await members('STUDENT');
        if (input.includeParents) out.parents = await parentsOf(out.students);
        break;
      case 'TEACHERS':
        out.teachers = await members('TEACHER');
        break;
      case 'PARENTS':
        out.parents = await members('PARENT');
        break;
      case 'GRADE':
      case 'SECTION': {
        const letter = input.section?.replace(/^\d+/, '').toUpperCase() || null;
        const grade = input.gradeLevel ?? (input.section ? Number(input.section.match(/^\d+/)?.[0]) || null : null);
        const rows = await this.prisma.enrollment.findMany({
          where: {
            status: 'ACTIVE',
            class: { schoolId, ...(grade ? { gradeLevel: grade } : {}), ...(input.audience === 'SECTION' && letter ? { sectionLabel: letter } : {}) },
          },
          select: { studentId: true },
        });
        out.students = [...new Set(rows.map((r) => r.studentId))];
        if (input.includeParents) out.parents = await parentsOf(out.students);
        break;
      }
    }
    if (authorId) for (const k of Object.keys(out) as (keyof AnnouncementRecipients)[]) out[k] = out[k].filter((id) => id !== authorId);
    return out;
  }

  /** Counts for a card preview. */
  async counts(schoolId: string, input: AnnouncementInput, authorId?: string) {
    const r = await this.recipients(schoolId, input, authorId);
    const total = new Set([...r.students, ...r.teachers, ...r.parents, ...r.staff]).size;
    return { students: r.students.length, teachers: r.teachers.length, parents: r.parents.length, total };
  }

  async send(a: AuthContext, input: AnnouncementInput) {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'DIRECTOR' && actor.role !== 'ADMIN') throw new ForbiddenException();
    const r = await this.recipients(actor.schoolId, input, actor.userId);
    const ids = [...new Set([...r.students, ...r.teachers, ...r.parents, ...r.staff])];
    const letter = input.section?.replace(/^\d+/, '').toUpperCase() || null;
    const ann = await this.prisma.announcement.create({
      data: {
        schoolId: actor.schoolId,
        authorId: actor.userId,
        title: input.title,
        body: input.body,
        audience: input.audience,
        gradeLevel: input.gradeLevel ?? null,
        sectionKey: letter,
        includeParents: !!input.includeParents,
        recipientCount: ids.length,
      },
    });
    const author = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
    const payload = { announcementId: ann.id, title: ann.title, body: ann.body, byName: author?.name ?? '' };
    await this.notifications.notifyMany(ids, 'ANNOUNCEMENT', payload, `ann:${ann.id}`);
    for (const id of ids) this.bus.toUser(id, 'announcement', payload);
    return { id: ann.id, sent: ids.length, students: r.students.length, teachers: r.teachers.length, parents: r.parents.length };
  }
}
