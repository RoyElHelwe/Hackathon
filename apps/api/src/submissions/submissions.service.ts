import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AI_RETRY_BELOW, I18nText, localized, pickText, RubricItem, transition } from '@tajriba/shared';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { checkFollowUp, checkSubmission, hint } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { GamificationService } from '../gamification/gamification.service';
import { MissionsService } from '../missions/missions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PeerReviewsService } from '../peer-reviews/peer-reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { StuckService } from '../progress/stuck.service';
import { COPY_THRESHOLD, hammingDistance } from '../uploads/phash';
import { UploadsService } from '../uploads/uploads.service';
import { Prisma } from '../generated/prisma/client';
import { effectiveAiScore, ValidationService } from './validation.service';

const subInclude = {
  mission: { include: { topic: { include: { subject: true } } } },
  peerEvaluations: { include: { evaluator: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { assignedAt: 'desc' } },
  teacherReviews: { orderBy: { createdAt: 'desc' } },
  familyConfirmation: true,
  student: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.SubmissionInclude;

type FullSubmission = Prisma.SubmissionGetPayload<{ include: typeof subInclude }>;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly missions: MissionsService,
    private readonly peers: PeerReviewsService,
    private readonly validation: ValidationService,
    private readonly gamification: GamificationService,
    private readonly progress: ProgressService,
    private readonly stuck: StuckService,
    private readonly uploads: UploadsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async load(id: string): Promise<FullSubmission> {
    const s = await this.prisma.submission.findUnique({ where: { id }, include: subInclude });
    if (!s) throw new NotFoundException('Submission not found');
    return s;
  }

  private async assertOwner(a: AuthContext, s: FullSubmission) {
    await this.actors.assert(a, 'write', 'submission', { ownerId: s.studentId, classId: s.mission.classId });
    if (s.studentId !== a.userId) throw new ForbiddenException();
  }

  async serialize(s: FullSubmission, a: AuthContext) {
    const isOwner = s.studentId === a.userId;
    const validatedNote = s.status === 'VALIDATED' ? await this.prisma.notification.findUnique({ where: { dedupeKey: `validated:${s.id}` } }) : null;
    const peer = s.peerEvaluations[0];
    return {
      id: s.id,
      status: s.status,
      attempt: s.attempt,
      student: isOwner ? undefined : { id: s.student.id, name: s.student.name, avatarUrl: s.student.avatarUrl },
      mission: this.missions.serialize(s.mission),
      photoUploadIds: s.photoUploadIds,
      audioUploadId: s.audioUploadId,
      explanation: s.explanation,
      answers: s.answers,
      aiCheck: s.aiCheck,
      followUpAnswer: s.followUpAnswer,
      aiFollowUpCheck: s.aiFollowUpCheck,
      effectiveAiScore: effectiveAiScore(s),
      finalScore: s.finalScore,
      hintsUsed: s.hintsUsed,
      hints: s.hints ?? [],
      gradeSynced: s.gradeSynced,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      validatedAt: s.validatedAt,
      peer: peer
        ? {
            id: peer.id,
            status: peer.status,
            evaluatorFirstName: peer.evaluator.name.split(' ')[0],
            evaluatorAvatarUrl: peer.evaluator.avatarUrl,
            score: peer.status === 'DONE' ? peer.score : null,
            comment: peer.status === 'DONE' ? peer.comment : null,
            checklist: peer.status === 'DONE' ? peer.checklist : null,
            helpfulRating: peer.helpfulRating,
            fairnessFlag: isOwner ? undefined : peer.fairnessFlag,
          }
        : null,
      teacherReview: s.teacherReviews[0] ? { score: s.teacherReviews[0].score, comment: s.teacherReviews[0].comment, overrode: s.teacherReviews[0].overrode } : null,
      familyConfirmation: s.familyConfirmation ? { note: s.familyConfirmation.note, confirmedAt: s.familyConfirmation.confirmedAt } : null,
      rewards: validatedNote ? { ...(validatedNote.payload as { rewards?: object }).rewards, notificationId: validatedNote.id, seen: !!validatedNote.readAt } : null,
    };
  }

  async start(a: AuthContext, missionId: string) {
    const mission = await this.missions.getRaw(missionId);
    await this.actors.assert(a, 'read', 'mission', { classId: mission.classId, audience: mission.audience });
    await this.actors.assert(a, 'write', 'submission', { ownerId: a.userId });
    if (mission.status !== 'APPROVED') throw new BadRequestException({ message: 'This mission is not open yet.' });
    const open = await this.prisma.submission.findFirst({
      where: { missionId, studentId: a.userId, status: { not: 'VALIDATED' } },
      orderBy: { startedAt: 'desc' },
    });
    const sub = open ?? (await this.prisma.submission.create({ data: { missionId, studentId: a.userId } }));
    await this.progress.markInProgress(a.userId, mission.topicId);
    return this.serialize(await this.load(sub.id), a);
  }

  async mine(a: AuthContext) {
    const subs = await this.prisma.submission.findMany({
      where: { studentId: a.userId },
      include: { mission: { include: { topic: { include: { subject: true } } } }, peerEvaluations: { include: { evaluator: { select: { name: true } } }, orderBy: { assignedAt: 'desc' }, take: 1 } },
      orderBy: { startedAt: 'desc' },
    });
    return subs.map((s) => ({
      id: s.id,
      status: s.status,
      attempt: s.attempt,
      startedAt: s.startedAt,
      validatedAt: s.validatedAt,
      finalScore: s.finalScore,
      evaluatorFirstName: s.peerEvaluations[0]?.evaluator.name.split(' ')[0] ?? null,
      mission: { id: s.mission.id, title: s.mission.title, xpReward: s.mission.xpReward, audience: s.mission.audience, topicKey: s.mission.topic.key, subjectKey: s.mission.topic.subject.key },
    }));
  }

  /** A student's mission history, for their teachers, parents and the director. */
  async forStudent(a: AuthContext, studentId: string) {
    const enr = await this.prisma.enrollment.findMany({ where: { studentId } });
    await this.actors.assert(a, 'read', 'progress', { ownerId: studentId, ownerClassIds: enr.map((e) => e.classId) });
    const subs = await this.prisma.submission.findMany({
      where: { studentId },
      include: { mission: { include: { topic: { include: { subject: true } } } }, peerEvaluations: { include: { evaluator: { select: { name: true } } }, orderBy: { assignedAt: 'desc' }, take: 1 } },
      orderBy: { startedAt: 'desc' },
    });
    return subs.map((s) => ({
      id: s.id,
      status: s.status,
      attempt: s.attempt,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      validatedAt: s.validatedAt,
      finalScore: s.finalScore,
      aiScore: (s.aiCheck as { score?: number } | null)?.score ?? null,
      photoUploadIds: s.photoUploadIds,
      gradeSynced: s.gradeSynced,
      evaluatorFirstName: s.peerEvaluations[0]?.evaluator.name.split(' ')[0] ?? null,
      mission: { id: s.mission.id, title: s.mission.title, audience: s.mission.audience, topicKey: s.mission.topic.key, topicName: s.mission.topic.name, subjectKey: s.mission.topic.subject.key, classroomCourseWorkId: s.mission.classroomCourseWorkId },
    }));
  }

  async get(a: AuthContext, id: string) {
    const s = await this.load(id);
    const assignedToActor = s.peerEvaluations.some((p) => p.evaluatorId === a.userId);
    await this.actors.assert(a, 'read', 'submission', { ownerId: s.studentId, classId: s.mission.classId, assignedToActor });
    return this.serialize(s, a);
  }

  async hint(a: AuthContext, id: string, partialWork?: string) {
    const s = await this.load(id);
    await this.assertOwner(a, s);
    if (s.status !== 'IN_PROGRESS') throw new BadRequestException({ message: 'Hints are available while you work on the mission.' });
    if (s.hintsUsed >= 3) throw new BadRequestException({ message: 'No more hints — ask a friend!', askAFriend: true });
    const level = s.hintsUsed + 1;
    const locale = a.user.locale || 'en';
    const out = await this.ai.run(hint, {
      topicKey: s.mission.topic.key,
      missionTitle: pickText(s.mission.title as I18nText, locale),
      steps: localized(s.mission.steps as { en: string[] }, locale) ?? [],
      partialWork,
      level,
      locale,
    });
    const hints = [...((s.hints as { level: number; text: string }[] | null) ?? []), { level, text: out.hint }];
    await this.prisma.submission.update({ where: { id }, data: { hintsUsed: level, hints } });
    if (level >= 3) await this.stuck.onStudentEvent(s.studentId, s.mission.classId);
    return { level, hint: out.hint, remaining: 3 - level };
  }

  /** Same or near-same photo from a different student in the same class → possible_copy. */
  private async copyFlag(studentId: string, classId: string | null, photoIds: string[]): Promise<boolean> {
    if (!classId || !photoIds.length) return false;
    const mine = await this.prisma.upload.findMany({ where: { id: { in: photoIds }, phash: { not: null } }, select: { phash: true } });
    if (!mine.length) return false;
    const classmates = await this.prisma.enrollment.findMany({ where: { classId, studentId: { not: studentId } } });
    const others = await this.prisma.upload.findMany({
      where: { ownerId: { in: classmates.map((c) => c.studentId) }, kind: 'IMAGE', phash: { not: null } },
      select: { phash: true },
    });
    return mine.some((m) => others.some((o) => hammingDistance(m.phash!, o.phash!) <= COPY_THRESHOLD));
  }

  async submit(
    a: AuthContext,
    id: string,
    body: { photoUploadIds: string[]; audioUploadId?: string | null; explanation?: string | null; answers?: Record<string, string | number> | null },
  ) {
    const s = await this.load(id);
    await this.assertOwner(a, s);
    const ids = [...body.photoUploadIds, ...(body.audioUploadId ? [body.audioUploadId] : [])];
    if (ids.length) {
      const owned = await this.prisma.upload.count({ where: { id: { in: ids }, ownerId: a.userId } });
      if (owned !== ids.length) throw new BadRequestException({ message: 'Some files are not yours.' });
    }
    const hasProof = body.photoUploadIds.length > 0 || !!body.explanation?.trim();
    const r = transition(s.status, { type: 'SUBMIT' }, { hasProof });
    await this.prisma.submission.update({
      where: { id },
      data: {
        status: r.state,
        photoUploadIds: body.photoUploadIds,
        audioUploadId: body.audioUploadId ?? null,
        explanation: body.explanation ?? null,
        answers: body.answers ?? Prisma.DbNull,
        submittedAt: new Date(),
      },
    });
    await this.progress.recordAttempt(a.userId, s.mission.topicId);
    return this.runCheck(a, id);
  }

  /** Runs the AI check on a SUBMITTED submission. Safe to retry if the AI was unavailable. */
  async runCheck(a: AuthContext, id: string) {
    const s = await this.load(id);
    await this.assertOwner(a, s);
    if (s.status !== 'SUBMITTED') return this.serialize(s, a);
    const locale = a.user.locale || 'en';
    const images: Buffer[] = [];
    for (const pid of s.photoUploadIds) {
      const up = await this.prisma.upload.findUnique({ where: { id: pid }, select: { path: true } });
      if (up) images.push(await this.uploads.readFile(up.path).catch(() => Buffer.alloc(0)));
    }
    let check;
    try {
      // Never send names or emails: only mission content and the student's work.
      check = await this.ai.run(
        checkSubmission,
        {
          topicKey: s.mission.topic.key,
          missionTitle: pickText(s.mission.title as I18nText, locale),
          steps: localized(s.mission.steps as { en: string[] }, locale) ?? [],
          rubric: s.mission.rubric as RubricItem[],
          explanation: s.explanation ?? '',
          answers: (s.answers as Record<string, string | number>) ?? {},
          photoCount: images.filter((b) => b.length).length,
          locale,
        },
        { images: images.filter((b) => b.length) },
      );
    } catch (e) {
      if (e instanceof AiUnavailableError) throw e;
      throw new AiUnavailableError();
    }
    const flags = [...check.flags];
    if (await this.copyFlag(s.studentId, s.mission.classId, s.photoUploadIds)) flags.push('possible_copy');
    const aiCheck = { ...check, flags };
    let state = transition(s.status, { type: 'AI_DONE' }).state;
    if (check.score < AI_RETRY_BELOW) state = transition(state, { type: 'AI_LOW' }, { aiScore: check.score }).state;
    await this.prisma.submission.update({ where: { id }, data: { status: state, aiCheck } });
    if (state === 'RETRY') await this.stuck.onStudentEvent(s.studentId, s.mission.classId);
    return this.serialize(await this.load(id), a);
  }

  async followUp(a: AuthContext, id: string, answer: string) {
    const s = await this.load(id);
    await this.assertOwner(a, s);
    const ai = s.aiCheck as { score: number; followUpQuestion: string; flags: string[] } | null;
    if (!ai) throw new BadRequestException({ message: 'Bousla has not checked your work yet.' });
    transition(s.status, { type: 'FOLLOW_UP' }, { aiScore: ai.score });
    const locale = a.user.locale || 'en';
    const fu = await this.ai.run(checkFollowUp, {
      question: ai.followUpQuestion,
      answer,
      missionTitle: pickText(s.mission.title as I18nText, locale),
      locale,
    });
    await this.prisma.submission.update({
      where: { id },
      data: { status: 'FOLLOW_UP_ANSWERED', followUpAnswer: answer, aiFollowUpCheck: fu },
    });
    return this.route(a, id);
  }

  /** FOLLOW_UP_ANSWERED → FAMILY_CONFIRM | TEACHER_REVIEW | PEER_REVIEW (spends 1 point). */
  private async route(a: AuthContext, id: string) {
    const s = await this.load(id);
    const ai = s.aiCheck as { flags?: string[] } | null;
    const wallet = await this.gamification.ensureWallet(s.studentId);
    const candidate = s.mission.audience === 'FAMILY' ? null : await this.peers.findEvaluator(s);
    const r = transition('FOLLOW_UP_ANSWERED', { type: 'ROUTE' }, { audience: s.mission.audience, flags: ai?.flags ?? [], peerAvailable: !!candidate, wallet: wallet.points });
    await this.prisma.submission.update({ where: { id }, data: { status: r.state } });
    if (r.effects.includes('SPEND_POINT')) await this.gamification.walletDelta(s.studentId, -1, 'SPENT_FOR_REVIEW', s.id);
    if (r.effects.includes('ASSIGN_PEER') && candidate) await this.peers.assign(s, candidate.userId);
    if (r.state === 'FAMILY_CONFIRM') {
      const parents = await this.prisma.parentLink.findMany({ where: { studentId: s.studentId, status: 'VERIFIED' } });
      await this.notifications.notifyMany(parents.map((p) => p.parentId), 'MISSION_PUBLISHED', { submissionId: s.id, title: s.mission.title, familyConfirm: true }, `family:${s.id}`);
    }
    return this.serialize(await this.load(id), a);
  }

  async retry(a: AuthContext, id: string) {
    const s = await this.load(id);
    await this.assertOwner(a, s);
    transition(s.status, { type: 'RESTART' });
    await this.prisma.submission.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        attempt: s.attempt + 1,
        aiCheck: Prisma.DbNull,
        aiFollowUpCheck: Prisma.DbNull,
        followUpAnswer: null,
        submittedAt: null,
        hintsUsed: 0,
        hints: Prisma.DbNull,
        startedAt: new Date(),
      },
    });
    return this.serialize(await this.load(id), a);
  }

  // ---------- Teacher ----------

  async teacherReview(a: AuthContext, id: string, body: { score: number; comment?: string }) {
    const s = await this.load(id);
    await this.actors.assert(a, 'review', 'submission', { ownerId: s.studentId, classId: s.mission.classId });
    const r = transition(s.status, { type: 'TEACHER_SCORE', score: body.score });
    await this.prisma.teacherReview.create({
      data: { submissionId: id, teacherId: a.userId, score: body.score, comment: body.comment, overrode: s.status !== 'TEACHER_REVIEW' },
    });
    if (s.status === 'PEER_REVIEW') {
      await this.prisma.peerEvaluation.updateMany({ where: { submissionId: id, status: 'ASSIGNED' }, data: { status: 'EXPIRED' } });
    }
    if (r.effects.includes('REFUND_POINT')) await this.gamification.walletDelta(s.studentId, 1, 'REFUND', s.id);
    if (r.state === 'VALIDATED') {
      // Also covers overriding an already validated submission: the score is updated and the grade re-synced (XP is not re-awarded).
      await this.validation.validate(id, { teacherScore: body.score });
    } else {
      await this.prisma.submission.update({ where: { id }, data: { status: r.state, finalScore: null } });
      if (r.state === 'RETRY') await this.stuck.onStudentEvent(s.studentId, s.mission.classId);
    }
    return this.serialize(await this.load(id), a);
  }

  async reviewQueue(a: AuthContext, classId?: string) {
    const actor = await this.actors.actor(a);
    const classIds = actor.role === 'TEACHER' ? (classId ? actor.classIdsTaught!.filter((c) => c === classId) : actor.classIdsTaught!) : undefined;
    const subs = await this.prisma.submission.findMany({
      where: {
        mission: classIds ? { classId: { in: classIds } } : { class: { schoolId: actor.schoolId } },
        OR: [
          { status: 'TEACHER_REVIEW' },
          { peerEvaluations: { some: { fairnessFlag: true } }, status: { not: 'VALIDATED' } },
          { status: 'VALIDATED', gradeSynced: false, mission: { classroomCourseWorkId: { not: null } } },
          { status: 'PEER_REVIEW' },
        ],
      },
      include: subInclude,
      orderBy: { submittedAt: 'asc' },
    });
    const out = [];
    for (const s of subs) {
      const ai = s.aiCheck as { flags?: string[]; score?: number } | null;
      out.push({
        ...(await this.serialize(s, a)),
        flags: [...(ai?.flags ?? []), ...(s.peerEvaluations.some((p) => p.fairnessFlag) ? ['fairness_gap'] : [])],
        gradeSyncPending: s.status === 'VALIDATED' && !s.gradeSynced && !!s.mission.classroomCourseWorkId,
      });
    }
    return out;
  }
}
