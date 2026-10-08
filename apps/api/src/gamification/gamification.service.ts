import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { applyActivity, BadgeStats, earnedBadges, levelForXp, levelInfo, WALLET_START, XpReason } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface Rewards {
  xpGained: number;
  xpEvents: { reason: string; amount: number }[];
  levelBefore: number;
  levelAfter: number;
  newBadges: { key: string; name: unknown; icon: string }[];
  unlockedTopics: { id: string; key: string; name: unknown }[];
  streak: number;
}

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly actors: ActorService,
  ) {}

  async totalXp(studentId: string): Promise<number> {
    const agg = await this.prisma.xpEvent.aggregate({ where: { studentId }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }

  async addXp(studentId: string, amount: number, reason: XpReason, refId?: string, subjectId?: string | null) {
    if (amount <= 0) return;
    await this.prisma.xpEvent.create({ data: { studentId, amount, reason, refId, subjectId: subjectId ?? null } });
  }

  async ensureWallet(studentId: string) {
    return this.prisma.wallet.upsert({ where: { studentId }, update: {}, create: { studentId, points: WALLET_START } });
  }

  async walletDelta(studentId: string, delta: number, reason: string, refId?: string) {
    await this.ensureWallet(studentId);
    await this.prisma.wallet.update({ where: { studentId }, data: { points: { increment: delta } } });
    await this.prisma.walletTx.create({ data: { studentId, delta, reason, refId } });
  }

  /** Streak: any validated submission or completed evaluation counts for the day (Asia/Beirut). */
  async recordActivity(studentId: string, now = new Date()): Promise<{ current: number; milestoneXp: number }> {
    const s = await this.prisma.streak.upsert({ where: { studentId }, update: {}, create: { studentId } });
    const next = applyActivity({ current: s.current, longest: s.longest, lastActive: s.lastActive }, now);
    if (next.changed) {
      await this.prisma.streak.update({ where: { studentId }, data: { current: next.current, longest: next.longest, lastActive: next.lastActive } });
      if (next.milestoneXp) await this.addXp(studentId, next.milestoneXp, 'STREAK', `streak-${next.current}`);
    }
    return { current: next.current, milestoneXp: next.milestoneXp };
  }

  async badgeStats(studentId: string): Promise<BadgeStats> {
    const validated = await this.prisma.submission.findMany({
      where: { studentId, status: 'VALIDATED' },
      include: { mission: { include: { topic: true } } },
    });
    const evaluationsDone = await this.prisma.peerEvaluation.count({ where: { evaluatorId: studentId, status: 'DONE' } });
    const helpful = await this.prisma.peerEvaluation.count({ where: { evaluatorId: studentId, helpfulRating: { gte: 4 } } });
    const streak = await this.prisma.streak.findUnique({ where: { studentId } });
    return {
      validatedCount: validated.length,
      validatedTopicKeys: validated.map((v) => v.mission.topic.key),
      evaluationsDone,
      helpfulRatingsReceived: helpful,
      streakCurrent: streak?.current ?? 0,
      familyMissions: validated.filter((v) => v.mission.audience === 'FAMILY').length,
    };
  }

  async checkBadges(studentId: string) {
    const owned = await this.prisma.studentBadge.findMany({ where: { studentId }, include: { badge: true } });
    const keys = earnedBadges(await this.badgeStats(studentId), owned.map((o) => o.badge.key));
    if (!keys.length) return [];
    const badges = await this.prisma.badge.findMany({ where: { key: { in: keys } } });
    for (const b of badges) {
      await this.prisma.studentBadge.upsert({
        where: { studentId_badgeId: { studentId, badgeId: b.id } },
        update: {},
        create: { studentId, badgeId: b.id },
      });
      await this.notifications.notify(studentId, 'BADGE', { key: b.key, name: b.name, icon: b.icon }, `badge:${studentId}:${b.key}`);
    }
    return badges.map((b) => ({ key: b.key, name: b.name, icon: b.icon }));
  }

  async levelUpCheck(studentId: string, xpBefore: number) {
    const after = await this.totalXp(studentId);
    const lb = levelForXp(xpBefore);
    const la = levelForXp(after);
    if (la > lb) await this.notifications.notify(studentId, 'LEVEL_UP', { level: la }, `level:${studentId}:${la}`);
    return { levelBefore: lb, levelAfter: la, xpAfter: after };
  }

  async me(studentId: string) {
    const xp = await this.totalXp(studentId);
    const wallet = await this.ensureWallet(studentId);
    const streak = await this.prisma.streak.findUnique({ where: { studentId } });
    const allBadges = await this.prisma.badge.findMany({ orderBy: { key: 'asc' } });
    const owned = await this.prisma.studentBadge.findMany({ where: { studentId } });
    const bySubject = await this.prisma.xpEvent.groupBy({ by: ['subjectId'], where: { studentId }, _sum: { amount: true } });
    const subjects = await this.prisma.subject.findMany();
    const recentXp = await this.prisma.xpEvent.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 20 });
    const walletTxs = await this.prisma.walletTx.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 20 });
    const activeDays = await this.prisma.xpEvent.findMany({
      where: { studentId, createdAt: { gte: new Date(Date.now() - 35 * 86400_000) } },
      select: { createdAt: true },
    });
    return {
      xp,
      level: levelInfo(xp),
      wallet: wallet.points,
      streak: { current: streak?.current ?? 0, longest: streak?.longest ?? 0, lastActive: streak?.lastActive ?? null },
      badges: allBadges.map((b) => {
        const o = owned.find((x) => x.badgeId === b.id);
        return { key: b.key, name: b.name, icon: b.icon, earned: !!o, earnedAt: o?.earnedAt ?? null };
      }),
      subjects: subjects
        .map((s) => {
          const sxp = bySubject.find((x) => x.subjectId === s.id)?._sum.amount ?? 0;
          return { key: s.key, name: s.name, color: s.color, icon: s.icon, xp: sxp, level: levelInfo(sxp) };
        })
        .filter((s) => s.xp > 0),
      recentXp,
      walletTxs,
      activeDays: [...new Set(activeDays.map((d) => d.createdAt.toISOString().slice(0, 10)))],
    };
  }

  async progressMe(studentId: string) {
    const rows = await this.prisma.topicProgress.findMany({ where: { studentId }, include: { topic: { include: { subject: true } } } });
    return rows.map((r) => ({
      topicId: r.topicId,
      topicKey: r.topic.key,
      topicName: r.topic.name,
      subjectKey: r.topic.subject.key,
      state: r.state,
      bestScore: r.bestScore,
      attempts: r.attempts,
      masteredAt: r.masteredAt,
    }));
  }

  /** Class leaderboard: OFF by default; top 5 + "your rank" only. */
  async leaderboard(a: AuthContext, classId: string) {
    await this.actors.assert(a, 'read', 'class', { classId });
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, include: { school: true } });
    if (!cls) throw new NotFoundException();
    const settings = cls.settings as { leaderboardEnabled?: boolean };
    const policy = (cls.school.settings as { leaderboardPolicy?: string }).leaderboardPolicy;
    if (!settings.leaderboardEnabled || policy === 'ALWAYS_OFF') throw new ForbiddenException({ message: 'The leaderboard is turned off for this class.' });
    const enr = await this.prisma.enrollment.findMany({ where: { classId, status: 'ACTIVE' }, include: { student: true } });
    const sums = await this.prisma.xpEvent.groupBy({ by: ['studentId'], where: { studentId: { in: enr.map((e) => e.studentId) } }, _sum: { amount: true } });
    const ranked = enr
      .map((e) => ({ studentId: e.studentId, name: e.student.name.split(' ')[0], avatarUrl: e.student.avatarUrl, xp: sums.find((s) => s.studentId === e.studentId)?._sum.amount ?? 0 }))
      .sort((x, y) => y.xp - x.xp)
      .map((r, i) => ({ ...r, rank: i + 1, level: levelForXp(r.xp) }));
    const mine = ranked.find((r) => r.studentId === a.userId);
    return { top: ranked.slice(0, 5), me: mine ? { rank: mine.rank, xp: mine.xp, level: mine.level } : null, total: ranked.length };
  }
}
