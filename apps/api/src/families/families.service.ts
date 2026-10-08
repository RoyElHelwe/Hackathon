import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { checkFamilyCode, FAMILY_CODE_TTL_MS, makeFamilyCode, transition } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { MissionsService } from '../missions/missions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationService } from '../submissions/validation.service';

const CODE_MESSAGES = {
  not_found: "That code doesn't exist. Check the 6 digits with your child.",
  expired: 'This code has expired. Ask your child to make a new one in Tajriba (Me → Invite my family).',
  used: 'This code was already used. Ask your child for a new one.',
};

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly validation: ValidationService,
    private readonly missions: MissionsService,
  ) {}

  async createCode(a: AuthContext) {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'STUDENT') throw new ForbiddenException('Only students create family codes.');
    let code = makeFamilyCode();
    for (let i = 0; i < 20 && (await this.prisma.familyCode.findUnique({ where: { code } })); i++) code = makeFamilyCode();
    const fc = await this.prisma.familyCode.create({ data: { studentId: a.userId, code, expiresAt: new Date(Date.now() + FAMILY_CODE_TTL_MS) } });
    return { code: fc.code, expiresAt: fc.expiresAt };
  }

  /** Parent enters a child's 6-digit code → ParentLink(VERIFIED) + PARENT membership in the child's school. */
  async link(a: AuthContext, code: string) {
    const fc = await this.prisma.familyCode.findUnique({ where: { code } });
    const status = checkFamilyCode(fc);
    if (status !== 'ok') throw new BadRequestException({ message: CODE_MESSAGES[status], reason: status });
    if (fc!.studentId === a.userId) throw new BadRequestException({ message: "You can't link yourself as your own parent 🙂" });
    const studentMembership = await this.prisma.membership.findFirst({
      where: { userId: fc!.studentId, role: 'STUDENT', status: 'APPROVED' },
      include: { school: true },
    });
    if (!studentMembership) throw new BadRequestException({ message: 'This student is not in a school yet.' });
    // Mark used first (single-use) to avoid races.
    const used = await this.prisma.familyCode.updateMany({ where: { id: fc!.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw new BadRequestException({ message: CODE_MESSAGES.used, reason: 'used' });
    const membership = await this.prisma.membership.upsert({
      where: { userId_schoolId_role: { userId: a.userId, schoolId: studentMembership.schoolId, role: 'PARENT' } },
      update: { status: 'APPROVED' },
      create: { userId: a.userId, schoolId: studentMembership.schoolId, role: 'PARENT', status: 'APPROVED' },
    });
    await this.prisma.parentLink.upsert({
      where: { parentId_studentId: { parentId: a.userId, studentId: fc!.studentId } },
      update: { status: 'VERIFIED' },
      create: { parentId: a.userId, studentId: fc!.studentId, status: 'VERIFIED', method: 'FAMILY_CODE' },
    });
    const child = await this.prisma.user.findUniqueOrThrow({ where: { id: fc!.studentId }, select: { id: true, name: true, avatarUrl: true } });
    return { membershipId: membership.id, child, school: { id: studentMembership.school.id, name: studentMembership.school.name } };
  }

  async familyMissions(a: AuthContext) {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'PARENT') throw new ForbiddenException();
    const missions = await this.prisma.mission.findMany({
      where: { classId: { in: actor.childClassIds }, status: 'APPROVED', audience: 'FAMILY' },
      include: { topic: { include: { subject: true } }, submissions: { where: { studentId: { in: actor.childIds } }, include: { student: { select: { id: true, name: true } }, familyConfirmation: true }, orderBy: { startedAt: 'desc' } } },
    });
    return missions.map((m) => ({
      ...this.missions.serialize(m),
      childSubmissions: m.submissions.map((s) => ({
        id: s.id,
        status: s.status,
        child: { id: s.student.id, firstName: s.student.name.split(' ')[0] },
        photoUploadIds: s.photoUploadIds,
        explanation: s.explanation,
        submittedAt: s.submittedAt,
        confirmation: s.familyConfirmation ? { note: s.familyConfirmation.note, confirmedAt: s.familyConfirmation.confirmedAt } : null,
      })),
    }));
  }

  async confirm(a: AuthContext, submissionId: string, note?: string) {
    const sub = await this.prisma.submission.findUnique({ where: { id: submissionId }, include: { mission: true } });
    if (!sub) throw new NotFoundException();
    await this.actors.assert(a, 'read', 'submission', { ownerId: sub.studentId });
    const actor = await this.actors.actor(a);
    if (actor.role !== 'PARENT') throw new ForbiddenException();
    transition(sub.status, { type: 'PARENT_CONFIRM' });
    await this.prisma.familyMissionConfirmation.create({ data: { submissionId, parentId: a.userId, note } });
    const rewards = await this.validation.validate(submissionId);
    return { ok: true, rewards };
  }
}
