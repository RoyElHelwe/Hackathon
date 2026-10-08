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

  async join(a: AuthContext, code: string, role: 'TEACHER' | 'STUDENT') {
    const school = await this.prisma.school.findUnique({ where: { schoolCode: code } });
    if (!school) throw new NotFoundException({ message: "We couldn't find a school with that code. Check it with your director." });
    const existing = await this.prisma.membership.findUnique({
      where: { userId_schoolId_role: { userId: a.userId, schoolId: school.id, role } },
    });
    if (existing) return { membership: existing, school: { id: school.id, name: school.name } };
    const membership = await this.prisma.membership.create({
      data: { userId: a.userId, schoolId: school.id, role, status: 'PENDING' },
    });
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
    return rows.map((m) => ({ id: m.id, role: m.role, status: m.status, createdAt: m.createdAt, user: m.user }));
  }

  async decide(a: AuthContext, membershipId: string, status: 'APPROVED' | 'REJECTED') {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw new NotFoundException();
    const actor = await this.actors.actor(a);
    if (actor.schoolId !== m.schoolId) throw new ForbiddenException();
    const admin = actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
    if (!admin && !(actor.role === 'TEACHER' && m.role === 'STUDENT')) throw new ForbiddenException();
    if (m.role === 'DIRECTOR' && actor.role !== 'DIRECTOR') throw new ForbiddenException();
    return this.prisma.membership.update({ where: { id: m.id }, data: { status } });
  }

  async updateSettings(a: AuthContext, schoolId: string, patch: Record<string, unknown>) {
    await this.actors.assert(a, 'write', 'school', { schoolId });
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const settings = { ...(school.settings as Record<string, unknown>), ...patch };
    return this.prisma.school.update({ where: { id: schoolId }, data: { settings: settings as Prisma.InputJsonValue } });
  }

  // ---------- Invites ----------

  async createInvite(a: AuthContext, body: { email: string; role: Role; studentId?: string }) {
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
    const invite = await this.prisma.invite.create({
      data: {
        schoolId: actor.schoolId,
        email: body.email.toLowerCase(),
        role: body.role,
        studentId: body.studentId,
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
    await this.prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    return { membershipId: membership.id, role: membership.role };
  }
}
