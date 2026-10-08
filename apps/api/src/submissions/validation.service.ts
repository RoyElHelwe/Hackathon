import { Injectable } from '@nestjs/common';
import { finalScore, missionXp } from '@tajriba/shared';
import { ClassroomService } from '../classroom/classroom.service';
import { GamificationService, Rewards } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { Prisma, Submission } from '../generated/prisma/client';

export function effectiveAiScore(sub: Pick<Submission, 'aiCheck' | 'aiFollowUpCheck'>): number | null {
  const ai = (sub.aiCheck as { score?: number } | null)?.score;
  if (ai == null) return null;
  const delta = (sub.aiFollowUpCheck as { scoreDelta?: number } | null)?.scoreDelta ?? 0;
  return Math.max(0, Math.min(100, ai + delta));
}

@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly progress: ProgressService,
    private readonly classroom: ClassroomService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * On VALIDATED: final score, XP, mastery + unlocks, badges, streak, level-up, grade passback.
   * Idempotent per submission (XP is only awarded once).
   */
  async validate(submissionId: string, opts: { teacherScore?: number } = {}): Promise<Rewards> {
    const sub = await this.prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: {
        mission: { include: { topic: true } },
        peerEvaluations: { where: { status: 'DONE' }, orderBy: { doneAt: 'desc' } },
        teacherReviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    const studentId = sub.studentId;
    const teacher = opts.teacherScore ?? sub.teacherReviews[0]?.score ?? null;
    const peer = sub.mission.audience === 'FAMILY' ? null : (sub.peerEvaluations[0]?.score ?? null);
    const score = finalScore({ teacher, ai: effectiveAiScore(sub), peer });

    const already = await this.prisma.xpEvent.findFirst({ where: { refId: sub.id, reason: 'MISSION_VALIDATED' } });
    await this.prisma.submission.update({
      where: { id: sub.id },
      data: { status: 'VALIDATED', finalScore: score, validatedAt: sub.validatedAt ?? new Date() },
    });

    const xpBefore = await this.gamification.totalXp(studentId);
    const xpEvents: { reason: string; amount: number }[] = [];
    let unlocked: string[] = [];
    let newBadges: Rewards['newBadges'] = [];
    let streak = 0;
    if (!already) {
      const awards = missionXp({
        difficulty: sub.mission.difficulty,
        attempt: sub.attempt,
        followUpUnderstood: !!(sub.aiFollowUpCheck as { understood?: boolean } | null)?.understood,
        family: sub.mission.audience === 'FAMILY',
      });
      for (const aw of awards) {
        await this.gamification.addXp(studentId, aw.amount, aw.reason, sub.id, sub.mission.topic.subjectId);
        xpEvents.push(aw);
      }
      unlocked = await this.progress.master(studentId, sub.mission.topicId, score);
      const st = await this.gamification.recordActivity(studentId);
      streak = st.current;
      if (st.milestoneXp) xpEvents.push({ reason: 'STREAK', amount: st.milestoneXp });
      newBadges = await this.gamification.checkBadges(studentId);
    }
    const level = await this.gamification.levelUpCheck(studentId, xpBefore);
    const topics = unlocked.length ? await this.prisma.topic.findMany({ where: { id: { in: unlocked } } }) : [];
    const rewards: Rewards = {
      xpGained: xpEvents.reduce((s, e) => s + e.amount, 0),
      xpEvents,
      levelBefore: level.levelBefore,
      levelAfter: level.levelAfter,
      newBadges,
      unlockedTopics: topics.map((t) => ({ id: t.id, key: t.key, name: t.name })),
      streak,
    };
    if (!already) {
      await this.notifications.notify(
        studentId,
        'SUBMISSION_VALIDATED',
        { submissionId: sub.id, missionId: sub.missionId, title: sub.mission.title, finalScore: score, rewards } as unknown as Record<string, Prisma.InputJsonValue>,
        `validated:${sub.id}`,
      );
    }
    await this.classroom.pushGrade(sub.id);
    return rewards;
  }
}
