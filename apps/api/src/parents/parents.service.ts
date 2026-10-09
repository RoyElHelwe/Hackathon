import { Injectable } from '@nestjs/common';
import { dayKey, I18nText, pickText } from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { parentSummary } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StuckService } from '../progress/stuck.service';

/** Monday (Asia/Beirut calendar) of the week containing `date`, as a UTC midnight Date. */
export function weekStartOf(date: Date): Date {
  const day = dayKey(date);
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly stuck: StuckService,
    private readonly notifications: NotificationsService,
  ) {}

  /** `lang` = the language on the parent's screen right now (the saved profile locale can lag behind a switch). */
  async summary(a: AuthContext, studentId: string, week?: string, opts: { regenerate?: boolean; lang?: string } = {}) {
    await this.actors.assert(a, 'read', 'parent_summary', { ownerId: studentId });
    const weekStart = weekStartOf(week ? new Date(`${week}T12:00:00Z`) : new Date());
    const locale = opts.lang && ['en', 'ar', 'fr'].includes(opts.lang) ? opts.lang : a.user.locale || 'en';
    const key = { parentId_studentId_weekStart_locale: { parentId: a.userId, studentId, weekStart, locale } };
    if (!opts.regenerate) {
      const existing = await this.prisma.parentSummary.findUnique({ where: key });
      if (existing) return this.serialize(existing);
    }
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000);
    const validated = await this.prisma.submission.findMany({
      where: { studentId, status: 'VALIDATED', validatedAt: { gte: weekStart, lt: weekEnd } },
      include: { mission: { include: { topic: true } } },
    });
    const enr = await this.prisma.enrollment.findMany({ where: { studentId, status: 'ACTIVE' } });
    const struggles = [];
    for (const e of enr) {
      for (const s of await this.stuck.forClass(e.classId)) {
        if (s.studentId === studentId) struggles.push({ topic: pickText(s.topicName as I18nText, locale), reason: s.reasons.join(', ') });
      }
    }
    const xp = await this.prisma.xpEvent.aggregate({ where: { studentId, createdAt: { gte: weekStart, lt: weekEnd } }, _sum: { amount: true } });
    const streak = await this.prisma.streak.findUnique({ where: { studentId } });
    const content = await this.ai.run(parentSummary, {
      locale,
      validated: validated.map((v) => ({ title: pickText(v.mission.title as I18nText, locale), topic: pickText(v.mission.topic.name as I18nText, locale), score: v.finalScore ?? 0 })),
      struggles,
      xpThisWeek: xp._sum.amount ?? 0,
      streak: streak?.current ?? 0,
    });
    const row = await this.prisma.parentSummary.upsert({
      where: key,
      update: { content },
      create: { parentId: a.userId, studentId, weekStart, locale, content },
    });
    await this.notifications.notify(a.userId, 'SUMMARY_READY', { studentId, weekStart: weekStart.toISOString() }, `summary:${a.userId}:${studentId}:${weekStart.toISOString()}`);
    return this.serialize(row);
  }

  private serialize(r: { weekStart: Date; locale: string; content: unknown; createdAt: Date; studentId: string }) {
    return { studentId: r.studentId, weekStart: r.weekStart, locale: r.locale, content: r.content, createdAt: r.createdAt };
  }
}
