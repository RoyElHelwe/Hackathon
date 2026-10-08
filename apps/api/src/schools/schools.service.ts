import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { makeSchoolCode, Role } from '@tajriba/shared';
import { randomToken } from '../common/crypto';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

const INVITE_TTL_MS = 14 * 24 * 3600 * 1000;

@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(a: AuthContext, body: { name: string; city: string; gradeLevels: number[] }) {
    let code = makeSchoolCode(body.city);
    for (let i = 0; i < 10 && (await this.prisma.school.findUnique({ where: { schoolCode: code } })); i++) {
      code = makeSchoolCode(body.city);
    }
    const school = await this.prisma.school.create({
      data: {
        name: body.name,
        city: body.city,
        schoolCode: code,
        settings: { gradeLevels: body.gradeLevels, leaderboardPolicy: 'TEACHER_CHOICE', defaultLocale: 'en', safetyRules: [] },
      },
    });
    const membership = await this.prisma.membership.create({
      data: { userId: a.userId, schoolId: school.id, role: 'DIRECTOR', status: 'APPROVED' },
    });
    return { school, membershipId: membership.id };
  }

  async get(a: AuthContext, schoolId: string) {
    await this.actors.assert(a, 'read', 'school', { schoolId });
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException();
    return school;
  }

  async join(a: AuthContext, code: string, role: 'TEACHER' | 'STUDENT', subjectIds?: string[]) {
    const school = await this.prisma.school.findUnique({ where: { schoolCode: code } });
    if (!school) throw new NotFoundException({ message: "We couldn't find a school with that code. Check it with your director." });
    const existing = await this.prisma.membership.findUnique({
      where: { userId_schoolId_role: { userId: a.userId, schoolId: school.id, role } },
    });
    // Validate before creating the membership row, so a bad subject id never leaves an orphan PENDING membership.
    const ids = role === 'TEACHER' ? await this.validSubjectIds(school.id, subjectIds) : [];
    const membership =
      existing ??
      (await this.prisma.membership.create({
        data: { userId: a.userId, schoolId: school.id, role, status: 'PENDING' },
      }));
    if (ids.length) await this.replaceTeacherSubjects(a.userId, school.id, ids);
    if (existing) return { membership, school: { id: school.id, name: school.name } };
    const approvers = await this.prisma.membership.findMany({
      where: { schoolId: school.id, status: 'APPROVED', role: { in: role === 'STUDENT' ? ['DIRECTOR', 'ADMIN', 'TEACHER'] : ['DIRECTOR', 'ADMIN'] } },
    });
    await this.notifications.notifyMany(
      approvers.map((m) => m.userId),
      'MEMBER_PENDING',
      { membershipId: membership.id, name: a.user.name, role },
      `pending:${membership.id}`,
    );
    return { membership, school: { id: school.id, name: school.name } };
  }

  async members(a: AuthContext, schoolId: string, status?: string) {
    const actor = await this.actors.actor(a);
    const admin = actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
    if (actor.schoolId !== schoolId) throw new ForbiddenException();
    // Teachers may see pending STUDENT requests (they approve students who joined with a code).
    if (!admin && !(actor.role === 'TEACHER' && status === 'PENDING')) throw new ForbiddenException();
    const where: Prisma.MembershipWhereInput = { schoolId };
    if (status) where.status = status as Prisma.MembershipWhereInput['status'];
    if (!admin) where.role = 'STUDENT';
    const rows = await this.prisma.membership.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const teacherIds = rows.filter((m) => m.role === 'TEACHER').map((m) => m.userId);
    const ts = await this.prisma.teacherSubject.findMany({
      where: { schoolId, teacherId: { in: teacherIds } },
      include: { subject: { select: { id: true, name: true } } },
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt,
      user: m.user,
      subjects: m.role === 'TEACHER' ? ts.filter((x) => x.teacherId === m.userId).map((x) => x.subject) : [],
    }));
  }

  async decide(a: AuthContext, membershipId: string, status: 'APPROVED' | 'REJECTED') {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw new NotFoundException();
    const actor = await this.actors.actor(a);
    if (actor.schoolId !== m.schoolId) throw new ForbiddenException();
    const admin = actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
    if (!admin && !(actor.role === 'TEACHER' && m.role === 'STUDENT')) throw new ForbiddenException();
    if (m.role === 'DIRECTOR' && actor.role !== 'DIRECTOR') throw new ForbiddenException();
    if (status === 'REJECTED' && m.role === 'TEACHER') {
      await this.prisma.teacherSubject.deleteMany({ where: { teacherId: m.userId, schoolId: m.schoolId } });
    }
    return this.prisma.membership.update({ where: { id: m.id }, data: { status } });
  }

  async updateSettings(a: AuthContext, schoolId: string, patch: Record<string, unknown>) {
    await this.actors.assert(a, 'write', 'school', { schoolId });
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const settings = { ...(school.settings as Record<string, unknown>), ...patch };
    return this.prisma.school.update({ where: { id: schoolId }, data: { settings: settings as Prisma.InputJsonValue } });
  }

  // ---------- Invites ----------

  /** Throws 400 unless every id is a subject of this school. */
  private async validSubjectIds(schoolId: string, ids: string[] | undefined): Promise<string[]> {
    const unique = [...new Set(ids ?? [])];
    if (!unique.length) return [];
    const found = await this.prisma.subject.count({ where: { id: { in: unique }, schoolId } });
    if (found !== unique.length) throw new BadRequestException({ message: 'Pick subjects from your school list.' });
    return unique;
  }

  private async replaceTeacherSubjects(teacherId: string, schoolId: string, subjectIds: string[]) {
    await this.prisma.$transaction([
      this.prisma.teacherSubject.deleteMany({ where: { teacherId, schoolId } }),
      this.prisma.teacherSubject.createMany({ data: subjectIds.map((subjectId) => ({ teacherId, schoolId, subjectId })), skipDuplicates: true }),
    ]);
  }

  async createInvite(a: AuthContext, body: { email: string; role: Role; studentId?: string; subjectIds?: string[] }) {
    const actor = await this.actors.actor(a);
    const admin = actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
    if (body.role === 'PARENT') {
      if (!body.studentId) throw new BadRequestException('studentId is required for parent invites');
      const enr = await this.prisma.enrollment.findMany({ where: { studentId: body.studentId, status: 'ACTIVE' } });
      const ok = admin || enr.some((e) => actor.classIdsTaught?.includes(e.classId));
      if (!ok) throw new ForbiddenException();
    } else if (!admin) {
      throw new ForbiddenException('Only directors can invite staff.');
    } else if (body.role === 'DIRECTOR' && actor.role !== 'DIRECTOR') {
      throw new ForbiddenException();
    }
    const subjectIds = body.role === 'TEACHER' ? await this.validSubjectIds(actor.schoolId, body.subjectIds) : [];
    if (body.role === 'TEACHER' && !subjectIds.length) throw new BadRequestException({ message: 'Choose at least one subject for this teacher.' });
    const invite = await this.prisma.invite.create({
      data: {
        schoolId: actor.schoolId,
        email: body.email.toLowerCase(),
        role: body.role,
        studentId: body.studentId,
        subjectIds,
        token: randomToken(),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    return { id: invite.id, token: invite.token, path: `/invite/${invite.token}`, expiresAt: invite.expiresAt };
  }

  async getInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token }, include: { school: true } });
    if (!invite) throw new NotFoundException({ message: 'This invite link is not valid.' });
    const student = invite.studentId
      ? await this.prisma.user.findUnique({ where: { id: invite.studentId }, select: { name: true } })
      : null;
    return {
      role: invite.role,
      school: { name: invite.school.name, city: invite.school.city },
      studentName: student?.name ?? null,
      expired: invite.expiresAt < new Date(),
      used: !!invite.usedAt,
    };
  }

  async acceptInvite(a: AuthContext, token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException({ message: 'This invite link is not valid.' });
    if (invite.usedAt) throw new BadRequestException({ message: 'This invite was already used.' });
    if (invite.expiresAt < new Date()) throw new BadRequestException({ message: 'This invite has expired. Ask for a new one.' });
    if (invite.email !== a.user.email.toLowerCase())
      throw new ForbiddenException({ message: `This invite was sent to ${invite.email}. Sign in with that Google account.` });

    const membership = await this.prisma.membership.upsert({
      where: { userId_schoolId_role: { userId: a.userId, schoolId: invite.schoolId, role: invite.role } },
      update: { status: 'APPROVED' },
      create: { userId: a.userId, schoolId: invite.schoolId, role: invite.role, status: 'APPROVED' },
    });
    if (invite.role === 'PARENT' && invite.studentId) {
      await this.prisma.parentLink.upsert({
        where: { parentId_studentId: { parentId: a.userId, studentId: invite.studentId } },
        update: { status: 'VERIFIED' },
        create: { parentId: a.userId, studentId: invite.studentId, status: 'VERIFIED', method: 'INVITE' },
      });
    }
    if (invite.role === 'TEACHER' && invite.subjectIds.length) {
      await this.replaceTeacherSubjects(a.userId, invite.schoolId, invite.subjectIds);
    }
    await this.prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    return { membershipId: membership.id, role: membership.role };
  }

  async setTeacherSubjects(a: AuthContext, membershipId: string, subjectIds: string[]) {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.role !== 'TEACHER') throw new NotFoundException();
    await this.actors.assert(a, 'write', 'members', { schoolId: m.schoolId });
    const ids = await this.validSubjectIds(m.schoolId, subjectIds);
    await this.replaceTeacherSubjects(m.userId, m.schoolId, ids);
    return { ok: true, subjectIds: ids };
  }

  async subjectsByCode(code: string) {
    const school = await this.prisma.school.findUnique({ where: { schoolCode: code.toUpperCase() }, include: { subjects: true } });
    if (!school) throw new NotFoundException({ message: "We couldn't find a school with that code. Check it with your director." });
    return { school: { name: school.name }, subjects: school.subjects.map((s) => ({ id: s.id, name: s.name })) };
  }
}
