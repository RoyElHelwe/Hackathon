import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { dayKey, I18nText, pickText, STUDY_ABANDON_MS, STUDY_INVITE_TTL_MS, STUDY_MIN_XP_MS, STUDY_XP, STUDY_XP_DAILY_CAP } from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { discussionCards } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { SessionLogService } from '../realtime/session-log.service';

const sessionInclude = {
  participants: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  class: { select: { id: true, name: true, schoolId: true } },
} as const;

/**
 * Peer study sessions: one student invites a classmate, both meet in a private 2D room with voice, emotes and AI
 * discussion cards. A session ends ONLY when a participant presses "End session" (or nobody has been in it for
 * STUDY_ABANDON_MS) — a participant dropping out never ends it for the other.
 */
@Injectable()
export class StudySessionsService {
  private readonly logger = new Logger('StudySessions');
  /** minimum gap between two invites from the same student to the same classmate (overridable in tests) */
  inviteGapMs = 10_000;
  private readonly lastInvite = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
    private readonly bus: RealtimeBus,
    private readonly sessionLog: SessionLogService,
  ) {}

  /** Classmates (same ACTIVE class) the student can invite, with their online state. */
  async classmates(a: AuthContext) {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'STUDENT') throw new ForbiddenException('Only students can start study sessions.');
    const classIds = actor.classIdsEnrolled ?? [];
    const rows = await this.prisma.enrollment.findMany({
      where: { classId: { in: classIds }, status: 'ACTIVE', studentId: { not: a.userId }, student: { status: 'ACTIVE' } },
      include: { student: { select: { id: true, name: true, avatarUrl: true } }, class: { select: { id: true, name: true } } },
      orderBy: { student: { name: 'asc' } },
    });
    const seen = new Set<string>();
    const out = [];
    for (const r of rows) {
      if (seen.has(r.studentId)) continue;
      seen.add(r.studentId);
      out.push({ userId: r.student.id, name: r.student.name, avatarUrl: r.student.avatarUrl, classId: r.class.id, className: r.class.name, online: this.bus.isOnline(r.student.id) });
    }
    return out.sort((x, y) => Number(y.online) - Number(x.online));
  }

  async create(a: AuthContext, body: { partnerId: string; classId?: string; topicId?: string }) {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'STUDENT') throw new ForbiddenException('Only students can start study sessions.');
    if (body.partnerId === a.userId) throw new BadRequestException('Pick a classmate to study with.');
    const shared = await this.prisma.enrollment.findMany({
      where: { studentId: body.partnerId, status: 'ACTIVE', classId: { in: actor.classIdsEnrolled ?? [] } },
      select: { classId: true },
    });
    const classId = body.classId && shared.some((s) => s.classId === body.classId) ? body.classId : shared[0]?.classId;
    if (!classId) throw new ForbiddenException('You can only study with classmates.');
    await this.actors.assert(a, 'write', 'study_session', { schoolId: actor.schoolId, classId, participantIds: [a.userId, body.partnerId] });
    this.throttleInvite(a.userId, body.partnerId);

    await this.expireStale();
    const busy = await this.prisma.studySession.findFirst({
      where: { status: 'ACTIVE', participants: { some: { userId: a.userId } } },
      select: { id: true },
    });
    if (busy) throw new ConflictException({ message: 'You are already in a study session.', code: 'ALREADY_IN_SESSION', sessionId: busy.id });
    // A new invite replaces the host's older pending invites.
    await this.prisma.studySession.updateMany({ where: { hostId: a.userId, status: 'INVITED' }, data: { status: 'EXPIRED', endedAt: new Date(), endedReason: 'REPLACED' } });

    let topicName: string | null = null;
    if (body.topicId) {
      const t = await this.schoolTopic(body.topicId, actor.schoolId);
      topicName = t ? pickText(t.name as I18nText, a.user.locale) : null;
    }
    const s = await this.prisma.studySession.create({
      data: {
        schoolId: actor.schoolId,
        classId,
        hostId: a.userId,
        topicId: topicName ? body.topicId : null,
        participants: { create: [{ userId: a.userId }, { userId: body.partnerId }] },
      },
    });
    const payload = { sessionId: s.id, fromId: a.userId, fromName: a.user.name, topic: topicName };
    await this.notifications.notify(body.partnerId, 'STUDY_INVITE', payload, `study-invite:${s.id}`);
    this.bus.toUser(body.partnerId, 'study:invite', payload);
    await this.sessionLog.log('STUDY', s.id, a.userId, 'INVITED', { partnerId: body.partnerId });
    return this.get(a, s.id);
  }

  async get(a: AuthContext, id: string) {
    const s = await this.prisma.studySession.findUnique({ where: { id }, include: sessionInclude });
    if (!s) throw new NotFoundException();
    const participantIds = s.participants.map((p) => p.userId);
    await this.actors.assert(a, 'read', 'study_session', { schoolId: s.class.schoolId, classId: s.classId, participantIds });
    let topic: string | null = null;
    if (s.topicId) {
      const t = await this.schoolTopic(s.topicId, s.class.schoolId);
      topic = t ? pickText(t.name as I18nText, a.user.locale) : null;
    }
    const events = await this.sessionLog.list('STUDY', id);
    return {
      id: s.id,
      status: s.status,
      hostId: s.hostId,
      classId: s.classId,
      className: s.class.name,
      topicId: s.topicId,
      topic,
      createdAt: s.createdAt,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      endedReason: s.endedReason,
      room: `study:${s.id}`,
      participants: s.participants.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        online: this.bus.presence.connected(`study:${s.id}`).some((x) => x.userId === p.userId),
      })),
      events: events.map((e) => ({ id: e.id, userId: e.userId, type: e.type, payload: e.payload, at: e.at })),
    };
  }

  /** The student's invites and recent sessions. */
  async mine(a: AuthContext) {
    await this.expireStale();
    const rows = await this.prisma.studySession.findMany({
      where: { participants: { some: { userId: a.userId } } },
      include: sessionInclude,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((s) => {
      const partner = s.participants.find((p) => p.userId !== a.userId);
      return {
        id: s.id,
        status: s.status,
        isHost: s.hostId === a.userId,
        partner: partner ? { userId: partner.userId, name: partner.user.name, avatarUrl: partner.user.avatarUrl } : null,
        className: s.class.name,
        createdAt: s.createdAt,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
      };
    });
  }

  async accept(a: AuthContext, id: string) {
    const s = await this.load(a, id, 'write');
    if (s.hostId === a.userId) throw new BadRequestException('Wait for your classmate to accept.');
    if (s.status === 'ACTIVE') return this.get(a, id);
    if (s.status !== 'INVITED' || Date.now() - s.createdAt.getTime() > STUDY_INVITE_TTL_MS) {
      throw new ConflictException({ message: 'This invite has expired.', code: 'EXPIRED' });
    }
    const busy = await this.prisma.studySession.findFirst({ where: { id: { not: id }, status: 'ACTIVE', participants: { some: { userId: a.userId } } }, select: { id: true } });
    if (busy) throw new ConflictException({ message: 'You are already in a study session.', code: 'ALREADY_IN_SESSION', sessionId: busy.id });
    const flipped = await this.prisma.studySession.updateMany({ where: { id, status: 'INVITED' }, data: { status: 'ACTIVE', startedAt: new Date() } });
    if (flipped.count) {
      const payload = { sessionId: id, byId: a.userId, byName: a.user.name };
      await this.notifications.notify(s.hostId, 'STUDY_ACCEPTED', payload, `study-accepted:${id}`);
      this.bus.toUser(s.hostId, 'study:accepted', payload);
      this.bus.toRoom(`study:${id}`, 'study:status', { sessionId: id, status: 'ACTIVE' });
      await this.sessionLog.log('STUDY', id, a.userId, 'ACCEPTED');
    }
    return this.get(a, id);
  }

  async decline(a: AuthContext, id: string) {
    const s = await this.load(a, id, 'write');
    if (s.status !== 'INVITED') throw new ConflictException({ message: 'This session already started.', code: 'NOT_INVITED' });
    await this.prisma.studySession.update({
      where: { id },
      data: { status: 'DECLINED', endedAt: new Date(), endedReason: s.hostId === a.userId ? 'CANCELLED' : 'DECLINED' },
    });
    for (const p of s.participants) this.bus.toUser(p.userId, 'study:ended', { sessionId: id, reason: 'DECLINED' });
    await this.sessionLog.log('STUDY', id, a.userId, s.hostId === a.userId ? 'CANCELLED' : 'DECLINED');
    return { ok: true };
  }

  /** Explicit "End session" — the only user action that ends it. Idempotent. */
  async end(a: AuthContext, id: string) {
    const s = await this.load(a, id, 'write');
    if (s.status === 'INVITED') return this.decline(a, id);
    if (s.status !== 'ACTIVE') return this.get(a, id);
    await this.finish(id, 'ENDED_BY_USER', a.userId);
    return this.get(a, id);
  }

  /** AI discussion cards for the room. */
  async cards(a: AuthContext, id: string) {
    const s = await this.load(a, id, 'read');
    let topic = '';
    if (s.topicId) {
      const t = await this.schoolTopic(s.topicId, s.class.schoolId);
      topic = t ? pickText(t.name as I18nText, a.user.locale) : '';
    }
    if (!topic) {
      const cls = await this.prisma.class.findUnique({ where: { id: s.classId }, include: { subject: true } });
      topic = cls?.subject ? pickText(cls.subject.name as I18nText, a.user.locale) : cls?.name ?? '';
    }
    return this.ai.run(discussionCards, { topic, locale: a.user.locale || 'en' });
  }

  /** Teacher view: study sessions in one of their classes. */
  async forClass(a: AuthContext, classId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!cls) throw new NotFoundException();
    await this.actors.assert(a, 'read', 'study_session', { schoolId: cls.schoolId, classId });
    const rows = await this.prisma.studySession.findMany({
      where: { classId, status: { in: ['ACTIVE', 'ENDED'] } },
      include: sessionInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const recs = await this.prisma.recording.groupBy({ by: ['refId'], where: { kind: 'STUDY', refId: { in: rows.map((r) => r.id) }, bytes: { gt: 0 } }, _count: true });
    return rows.map((s) => ({
      id: s.id,
      status: s.status,
      participants: s.participants.map((p) => ({ userId: p.userId, name: p.user.name })),
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      endedReason: s.endedReason,
      durationSec: s.startedAt ? Math.round(((s.endedAt ?? new Date()).getTime() - s.startedAt.getTime()) / 1000) : 0,
      recordings: recs.find((r) => r.refId === s.id)?._count ?? 0,
    }));
  }

  /** Ends a session (once) and gives XP to participants who actually joined, if it lasted long enough. */
  async finish(id: string, reason: string, byUserId: string | null) {
    const now = new Date();
    const flipped = await this.prisma.studySession.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'ENDED', endedAt: now, endedReason: reason } });
    if (!flipped.count) return;
    const s = await this.prisma.studySession.findUniqueOrThrow({ where: { id }, include: { participants: true, class: { select: { subjectId: true } } } });
    const lasted = s.startedAt ? now.getTime() - s.startedAt.getTime() : 0;
    if (lasted >= STUDY_MIN_XP_MS) {
      for (const p of s.participants.filter((x) => x.joinedAt)) {
        if (await this.dailyCapReached(p.userId, now)) continue;
        const before = await this.gamification.totalXp(p.userId);
        await this.gamification.addXp(p.userId, STUDY_XP, 'STUDY_SESSION', id, s.class.subjectId);
        await this.gamification.recordActivity(p.userId, now);
        await this.gamification.levelUpCheck(p.userId, before);
      }
    }
    await this.sessionLog.log('STUDY', id, byUserId, 'ENDED', { reason, lastedSec: Math.round(lasted / 1000), xp: lasted >= STUDY_MIN_XP_MS ? STUDY_XP : 0 });
    this.bus.toRoom(`study:${id}`, 'study:ended', { sessionId: id, reason, byId: byUserId, xp: lasted >= STUDY_MIN_XP_MS ? STUDY_XP : 0 });
  }

  /** Cron: expire old invites and end sessions nobody has been in for STUDY_ABANDON_MS. Idempotent. */
  async sweep(now = new Date()): Promise<number> {
    let n = await this.expireStale(now);
    const active = await this.prisma.studySession.findMany({ where: { status: 'ACTIVE' }, include: { participants: true } });
    for (const s of active) {
      if (this.bus.presence.connected(`study:${s.id}`).length) continue;
      const last = Math.max(s.startedAt?.getTime() ?? 0, ...s.participants.map((p) => p.lastSeen?.getTime() ?? 0));
      if (now.getTime() - last > STUDY_ABANDON_MS) {
        await this.finish(s.id, 'ABANDONED', null);
        n++;
      }
    }
    return n;
  }

  /** A topic usable in this school: global or the school's own subject, and (for lesson skills) the school's course. */
  private schoolTopic(topicId: string, schoolId: string) {
    return this.prisma.topic.findFirst({
      where: { id: topicId, subject: { OR: [{ schoolId: null }, { schoolId }] }, OR: [{ courseId: null }, { course: { schoolId } }] },
      select: { name: true },
    });
  }

  private throttleInvite(fromId: string, toId: string) {
    const key = `${fromId}>${toId}`;
    const now = Date.now();
    const last = this.lastInvite.get(key);
    if (last && now - last < this.inviteGapMs) {
      throw new HttpException({ message: 'You just invited this classmate — give them a few seconds.', code: 'INVITE_TOO_SOON' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.lastInvite.set(key, now);
    if (this.lastInvite.size > 5_000) {
      for (const [k, t] of this.lastInvite) if (now - t >= this.inviteGapMs) this.lastInvite.delete(k);
    }
  }

  /** STUDY_XP_DAILY_CAP rewarded sessions per student per (Beirut) day. */
  private async dailyCapReached(userId: string, now: Date): Promise<boolean> {
    const recent = await this.prisma.xpEvent.findMany({
      where: { studentId: userId, reason: 'STUDY_SESSION', createdAt: { gte: new Date(now.getTime() - 26 * 3_600_000) } },
      select: { createdAt: true },
    });
    const today = dayKey(now);
    return recent.filter((e) => dayKey(e.createdAt) === today).length >= STUDY_XP_DAILY_CAP;
  }

  private async expireStale(now = new Date()): Promise<number> {
    const r = await this.prisma.studySession.updateMany({
      where: { status: 'INVITED', createdAt: { lt: new Date(now.getTime() - STUDY_INVITE_TTL_MS) } },
      data: { status: 'EXPIRED', endedAt: now, endedReason: 'EXPIRED' },
    });
    return r.count;
  }

  private async load(a: AuthContext, id: string, action: 'read' | 'write') {
    const s = await this.prisma.studySession.findUnique({ where: { id }, include: { participants: true, class: { select: { schoolId: true } } } });
    if (!s) throw new NotFoundException();
    await this.actors.assert(a, action, 'study_session', { schoolId: s.class.schoolId, classId: s.classId, participantIds: s.participants.map((p) => p.userId) });
    return s;
  }
}
