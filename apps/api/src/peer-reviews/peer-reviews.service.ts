import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EvaluatorCandidate, I18nText, pickEvaluator, pickText, RubricItem, transition, XP_BONUS } from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { peerSheet } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mission, Submission } from '../generated/prisma/client';
import { effectiveAiScore, ValidationService } from '../submissions/validation.service';

export const PEER_TIMEOUT_MS = 24 * 3600 * 1000;

@Injectable()
export class PeerReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
    private readonly validation: ValidationService,
  ) {}

  /** Eligible = same class, ACTIVE enrollment, topic MASTERED, not the submitter, < 3 open reviews. */
  async findEvaluator(sub: Submission & { mission: Mission }, exclude: string[] = []): Promise<EvaluatorCandidate | null> {
    if (!sub.mission.classId) return null;
    const enr = await this.prisma.enrollment.findMany({ where: { classId: sub.mission.classId } });
    const ids = enr.map((e) => e.studentId);
    const mastered = await this.prisma.topicProgress.findMany({ where: { studentId: { in: ids }, topicId: sub.mission.topicId, state: 'MASTERED' } });
    const open = await this.prisma.peerEvaluation.groupBy({ by: ['evaluatorId'], where: { evaluatorId: { in: ids }, status: 'ASSIGNED' }, _count: true });
    const last = await this.prisma.peerEvaluation.groupBy({ by: ['evaluatorId'], where: { evaluatorId: { in: ids } }, _max: { assignedAt: true } });
    const candidates: EvaluatorCandidate[] = enr.map((e) => ({
      userId: e.studentId,
      sameClass: true,
      enrollmentActive: e.status === 'ACTIVE',
      topicMastered: mastered.some((m) => m.studentId === e.studentId),
      openReviews: open.find((o) => o.evaluatorId === e.studentId)?._count ?? 0,
      lastAssignedAt: last.find((l) => l.evaluatorId === e.studentId)?._max.assignedAt ?? null,
    }));
    return pickEvaluator(candidates, sub.studentId, exclude);
  }

  async assign(sub: Submission & { mission: Mission }, evaluatorId: string) {
    const rubric = sub.mission.rubric as RubricItem[];
    const sheet = await this.ai.run(peerSheet, {
      topicKey: (await this.prisma.topic.findUniqueOrThrow({ where: { id: sub.mission.topicId } })).key,
      missionTitle: pickText(sub.mission.title as I18nText, 'en'),
      rubric,
      submissionSummary: `${sub.photoUploadIds.length} photo(s); numbers: ${JSON.stringify(sub.answers ?? {})}; explanation length ${sub.explanation?.length ?? 0} chars`,
      locale: 'en',
    });
    const ev = await this.prisma.peerEvaluation.create({ data: { submissionId: sub.id, evaluatorId, sheet } });
    await this.notifications.notify(evaluatorId, 'PEER_REVIEW_ASSIGNED', { peerEvaluationId: ev.id, missionTitle: sub.mission.title }, `peer:${ev.id}`);
    return ev;
  }

  async assigned(a: AuthContext) {
    const rows = await this.prisma.peerEvaluation.findMany({
      where: { evaluatorId: a.userId },
      include: { submission: { include: { mission: { include: { topic: true } }, student: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { assignedAt: 'desc' },
      take: 30,
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      assignedAt: r.assignedAt,
      doneAt: r.doneAt,
      score: r.score,
      helpfulRating: r.helpfulRating,
      dueAt: new Date(r.assignedAt.getTime() + PEER_TIMEOUT_MS),
      mission: { id: r.submission.mission.id, title: r.submission.mission.title, topicKey: r.submission.mission.topic.key },
      submitter: { firstName: r.submission.student.name.split(' ')[0], avatarUrl: r.submission.student.avatarUrl },
    }));
  }

  private async load(id: string) {
    const ev = await this.prisma.peerEvaluation.findUnique({
      where: { id },
      include: { submission: { include: { mission: { include: { topic: true } }, student: { select: { name: true, avatarUrl: true } } } } },
    });
    if (!ev) throw new NotFoundException();
    return ev;
  }

  async get(a: AuthContext, id: string) {
    const ev = await this.load(id);
    await this.actors.assert(a, 'read', 'peer_evaluation', { evaluatorId: ev.evaluatorId, classId: ev.submission.mission.classId });
    const s = ev.submission;
    const m = s.mission;
    return {
      id: ev.id,
      status: ev.status,
      sheet: ev.sheet,
      checklist: ev.checklist,
      score: ev.score,
      comment: ev.comment,
      helpfulRating: ev.helpfulRating,
      assignedAt: ev.assignedAt,
      dueAt: new Date(ev.assignedAt.getTime() + PEER_TIMEOUT_MS),
      submitter: { firstName: s.student.name.split(' ')[0], avatarUrl: s.student.avatarUrl },
      mission: { id: m.id, title: m.title, story: m.story, steps: m.steps, rubric: m.rubric, proofSpec: m.proofSpec, topicKey: m.topic.key, xpReward: m.xpReward },
      // Blind review: the AI score is not shown to the peer.
      submission: { id: s.id, photoUploadIds: s.photoUploadIds, audioUploadId: s.audioUploadId, explanation: s.explanation, answers: s.answers, followUpQuestion: (s.aiCheck as { followUpQuestion?: string } | null)?.followUpQuestion ?? null, followUpAnswer: s.followUpAnswer },
    };
  }

  async complete(a: AuthContext, id: string, body: { checklist: { criterion: string; ok: boolean }[]; score: number; comment?: string }) {
    const ev = await this.load(id);
    await this.actors.assert(a, 'write', 'peer_evaluation', { evaluatorId: ev.evaluatorId });
    if (ev.status !== 'ASSIGNED') throw new BadRequestException({ message: 'This review is already closed.' });
    const sub = ev.submission;
    if (sub.status !== 'PEER_REVIEW') throw new BadRequestException({ message: 'This submission is no longer waiting for a review.' });

    const r = transition(sub.status, { type: 'PEER_DONE', peerScore: body.score }, { aiScore: effectiveAiScore(sub) });
    await this.prisma.peerEvaluation.update({
      where: { id },
      data: { checklist: body.checklist, score: body.score, comment: body.comment, status: 'DONE', doneAt: new Date(), fairnessFlag: r.effects.includes('FAIRNESS_FLAG') },
    });

    // Evaluator rewards: +1 point, +15 XP, streak.
    const xpBefore = await this.gamification.totalXp(a.userId);
    await this.gamification.walletDelta(a.userId, 1, 'EARNED_BY_REVIEWING', ev.id);
    await this.gamification.addXp(a.userId, XP_BONUS.PEER_EVAL_GIVEN, 'PEER_EVAL_GIVEN', ev.id, sub.mission.topic.subjectId);
    await this.gamification.recordActivity(a.userId);
    const badges = await this.gamification.checkBadges(a.userId);
    const level = await this.gamification.levelUpCheck(a.userId, xpBefore);

    if (r.state === 'VALIDATED') {
      await this.validation.validate(sub.id);
    } else {
      await this.prisma.submission.update({ where: { id: sub.id }, data: { status: r.state } });
    }
    return { ok: true, outcome: r.state, rewards: { xp: XP_BONUS.PEER_EVAL_GIVEN, points: 1, newBadges: badges, levelBefore: level.levelBefore, levelAfter: level.levelAfter } };
  }

  /** The evaluated student rates how helpful the review was. ≥ 4 gives the evaluator +5 XP. */
  async rate(a: AuthContext, id: string, helpfulRating: number) {
    const ev = await this.load(id);
    if (ev.submission.studentId !== a.userId) throw new ForbiddenException();
    if (ev.status !== 'DONE') throw new BadRequestException({ message: 'You can rate a review once it is done.' });
    if (ev.helpfulRating != null) return { ok: true };
    await this.prisma.peerEvaluation.update({ where: { id }, data: { helpfulRating } });
    if (helpfulRating >= 4) {
      await this.gamification.addXp(ev.evaluatorId, XP_BONUS.HELPFUL_REVIEW, 'HELPFUL_REVIEW', ev.id, ev.submission.mission.topic.subjectId);
      await this.gamification.checkBadges(ev.evaluatorId);
    }
    return { ok: true };
  }

  /** No answer in 24h → reassign once, then TEACHER_REVIEW with the point refunded. Idempotent. */
  async handleTimeouts(now = new Date()) {
    const stale = await this.prisma.peerEvaluation.findMany({
      where: { status: 'ASSIGNED', assignedAt: { lt: new Date(now.getTime() - PEER_TIMEOUT_MS) } },
      include: { submission: { include: { mission: true, peerEvaluations: true } } },
    });
    let handled = 0;
    for (const ev of stale) {
      await this.prisma.peerEvaluation.update({ where: { id: ev.id }, data: { status: 'EXPIRED' } });
      const sub = ev.submission;
      if (sub.status !== 'PEER_REVIEW') continue;
      const previous = sub.peerEvaluations.map((p) => p.evaluatorId);
      const candidate = await this.findEvaluator(sub, previous);
      const r = transition('PEER_REVIEW', { type: 'PEER_TIMEOUT' }, { alreadyReassigned: sub.peerEvaluations.length > 1, peerAvailable: !!candidate });
      if (r.effects.includes('REASSIGN_PEER') && candidate) {
        await this.assign(sub, candidate.userId);
      }
      if (r.effects.includes('REFUND_POINT')) {
        await this.gamification.walletDelta(sub.studentId, 1, 'REFUND', sub.id);
      }
      await this.prisma.submission.update({ where: { id: sub.id }, data: { status: r.state } });
      handled++;
    }
    return handled;
  }
}
