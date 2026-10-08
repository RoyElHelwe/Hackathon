import { ForbiddenException, Injectable } from '@nestjs/common';
import { dayKey, I18nText, levelInfo, pickText } from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { groupSession } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';
import { StuckService } from '../progress/stuck.service';

const WEEK_MS = 7 * 86400_000;

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly progress: ProgressService,
    private readonly stuck: StuckService,
    private readonly ai: AiService,
    private readonly gamification: GamificationService,
  ) {}

  /** Topics shown for a class: every topic of each subject that has a mission in the class (fallback: math). */
  private async classTopics(classId: string) {
    const missions = await this.prisma.mission.findMany({ where: { classId }, select: { topic: { select: { subjectId: true } } } });
    let subjectIds = [...new Set(missions.map((m) => m.topic.subjectId))];
    if (!subjectIds.length) {
      const math = await this.prisma.subject.findUnique({ where: { key: 'math' } });
      subjectIds = math ? [math.id] : [];
    }
    return this.prisma.topic.findMany({
      where: { subjectId: { in: subjectIds } },
      include: { prerequisites: true, subject: true },
      orderBy: [{ subject: { key: 'asc' } }, { posY: 'asc' }, { posX: 'asc' }],
    });
  }

  async teacher(a: AuthContext, classId: string) {
    await this.actors.assert(a, 'read', 'class', { classId });
    const actor = await this.actors.actor(a);
    if (actor.role !== 'TEACHER' && actor.role !== 'DIRECTOR' && actor.role !== 'ADMIN') throw new ForbiddenException();
    const cls = await this.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      include: { course: { include: { subject: { select: { id: true, name: true, color: true } } } } },
    });
    const topics = await this.classTopics(classId);
    const enr = await this.prisma.enrollment.findMany({ where: { classId, status: 'ACTIVE' }, include: { student: true }, orderBy: { student: { name: 'asc' } } });
    const stuck = await this.stuck.forClass(classId);
    const cells: { studentId: string; topicId: string; state: string; bestScore: number }[] = [];
    let masteredCount = 0;
    for (const e of enr) {
      const states = await this.progress.states(e.studentId, topics);
      for (const t of topics) {
        const s = states.get(t.id)!;
        if (s.state === 'MASTERED') masteredCount++;
        cells.push({ studentId: e.studentId, topicId: t.id, state: s.state, bestScore: s.bestScore });
      }
    }
    const recent = await this.prisma.submission.findMany({
      where: { mission: { classId }, studentId: { in: enr.map((e) => e.studentId) }, status: { not: 'IN_PROGRESS' } },
      include: { student: { select: { name: true, avatarUrl: true } }, mission: { select: { title: true } } },
      orderBy: [{ validatedAt: { sort: 'desc', nulls: 'last' } }, { submittedAt: { sort: 'desc', nulls: 'last' } }],
      take: 12,
    });
    const since = new Date(Date.now() - WEEK_MS);
    const studentIds = enr.map((e) => e.studentId);
    const validatedWeek = await this.prisma.submission.count({ where: { mission: { classId }, studentId: { in: studentIds }, status: 'VALIDATED', validatedAt: { gte: since } } });
    const pendingReviews = await this.prisma.submission.count({ where: { mission: { classId }, studentId: { in: studentIds }, status: 'TEACHER_REVIEW' } });
    return {
      class: {
        id: cls.id,
        name: cls.name,
        syncError: cls.syncError,
        lastSyncedAt: cls.lastSyncedAt,
        settings: cls.settings,
        classroomCourseId: cls.classroomCourseId,
        subjectId: cls.subjectId,
        gradeLevel: cls.gradeLevel,
        sectionLabel: cls.sectionLabel,
        course: cls.course ? { id: cls.course.id, gradeLevel: cls.course.gradeLevel, subject: cls.course.subject } : null,
      },
      topics: topics.map((t) => ({ id: t.id, key: t.key, name: t.name, subjectKey: t.subject.key, color: t.subject.color })),
      students: enr.map((e) => ({ id: e.studentId, name: e.student.name, avatarUrl: e.student.avatarUrl, stuck: stuck.some((s) => s.studentId === e.studentId) })),
      cells,
      stuck: stuck.map((s) => ({ ...s, topicName: s.topicName })),
      recent: recent.map((r) => ({
        submissionId: r.id,
        studentName: r.student.name,
        avatarUrl: r.student.avatarUrl,
        missionTitle: r.mission.title,
        status: r.status,
        at: r.validatedAt ?? r.submittedAt ?? r.startedAt,
      })),
      stats: {
        students: enr.length,
        avgMastery: enr.length && topics.length ? Math.round((100 * masteredCount) / (enr.length * topics.length)) : 0,
        validatedThisWeek: validatedWeek,
        pendingReviews,
        stuckCount: new Set(stuck.map((s) => s.studentId)).size,
      },
    };
  }

  /** AI group-session plan. Students are anonymized (s1, s2, …) before going to the AI. */
  async groupSessions(a: AuthContext, classId: string) {
    await this.actors.assert(a, 'write', 'class', { classId });
    const stuck = await this.stuck.forClass(classId);
    if (!stuck.length) return { groups: [] };
    const ids = [...new Set(stuck.map((s) => s.studentId))];
    const anon = new Map(ids.map((id, i) => [id, `s${i + 1}`]));
    const back = new Map(ids.map((id, i) => [`s${i + 1}`, id]));
    const locale = a.user.locale || 'en';
    const out = await this.ai.run(groupSession, {
      locale,
      stuck: stuck.map((s) => ({ studentId: anon.get(s.studentId)!, topic: pickText(s.topicName as I18nText, 'en'), reasons: s.reasons })),
    });
    const names = new Map(stuck.map((s) => [s.studentId, s.studentName]));
    return {
      groups: out.groups.map((g) => ({
        topic: g.topic,
        plan: g.plan,
        students: g.studentIds.map((sid) => back.get(sid)).filter((x): x is string => !!x).map((id) => ({ id, name: names.get(id) ?? '' })),
      })),
    };
  }

  async director(a: AuthContext, schoolId: string) {
    await this.actors.assert(a, 'read', 'members', { schoolId });
    const now = Date.now();
    const since = new Date(now - WEEK_MS);
    const students = await this.prisma.membership.findMany({ where: { schoolId, role: 'STUDENT', status: 'APPROVED' }, select: { userId: true } });
    const studentIds = students.map((s) => s.userId);
    const activeRows = await this.prisma.xpEvent.findMany({ where: { studentId: { in: studentIds }, createdAt: { gte: since } }, select: { studentId: true }, distinct: ['studentId'] });
    const activeSubs = await this.prisma.submission.findMany({ where: { studentId: { in: studentIds }, OR: [{ startedAt: { gte: since } }, { submittedAt: { gte: since } }] }, select: { studentId: true }, distinct: ['studentId'] });
    const activeSet = new Set([...activeRows.map((r) => r.studentId), ...activeSubs.map((r) => r.studentId)]);
    const validatedAll = await this.prisma.submission.findMany({
      where: { studentId: { in: studentIds }, status: 'VALIDATED', validatedAt: { gte: new Date(now - 14 * 86400_000) } },
      select: { validatedAt: true },
    });
    const missionsValidated = await this.prisma.submission.count({ where: { studentId: { in: studentIds }, status: 'VALIDATED' } });
    const missionsValidatedWeek = await this.prisma.submission.count({ where: { studentId: { in: studentIds }, status: 'VALIDATED', validatedAt: { gte: since } } });
    const withParent = await this.prisma.parentLink.findMany({ where: { studentId: { in: studentIds }, status: 'VERIFIED' }, select: { studentId: true }, distinct: ['studentId'] });
    const pending = await this.prisma.membership.count({ where: { schoolId, status: 'PENDING' } });

    const trend: { day: string; validated: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = dayKey(new Date(now - i * 86400_000));
      trend.push({ day, validated: validatedAll.filter((v) => v.validatedAt && dayKey(v.validatedAt) === day).length });
    }

    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      include: { teachers: { include: { teacher: { select: { name: true } } } }, enrollments: { where: { status: 'ACTIVE' } } },
      orderBy: { name: 'asc' },
    });
    const subjectOrder = ['math', 'physics', 'chemistry', 'biology', 'history', 'languages'];
    const topics = (await this.prisma.topic.findMany({ include: { subject: true, prerequisites: true }, orderBy: [{ posY: 'asc' }, { posX: 'asc' }] })).sort(
      (x, y) => subjectOrder.indexOf(x.subject.key) - subjectOrder.indexOf(y.subject.key),
    );
    const progressRows = await this.prisma.topicProgress.findMany({ where: { studentId: { in: studentIds }, state: 'MASTERED' }, select: { studentId: true, topicId: true } });
    const masteredSet = new Set(progressRows.map((r) => `${r.studentId}|${r.topicId}`));

    const coverage = topics.map((t) => ({
      topicId: t.id,
      topicKey: t.key,
      topicName: t.name,
      subjectKey: t.subject.key,
      subjectName: t.subject.name,
      color: t.subject.color,
      gradeLevel: t.gradeLevel,
      classes: classes.map((c) => {
        const n = c.enrollments.length;
        const m = c.enrollments.filter((e) => masteredSet.has(`${e.studentId}|${t.id}`)).length;
        return { classId: c.id, pct: n ? Math.round((100 * m) / n) : 0 };
      }),
    }));

    const classRows = [];
    for (const c of classes) {
      const ids = c.enrollments.map((e) => e.studentId);
      const active = ids.filter((id) => activeSet.has(id)).length;
      const stuck = await this.stuck.forClass(c.id);
      const classTopicIds = (await this.classTopics(c.id)).map((t) => t.id);
      const mastered = ids.reduce((s, id) => s + classTopicIds.filter((tid) => masteredSet.has(`${id}|${tid}`)).length, 0);
      classRows.push({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        teachers: c.teachers.map((t) => t.teacher.name),
        students: ids.length,
        engagement: ids.length ? Math.round((100 * active) / ids.length) : 0,
        stuckCount: new Set(stuck.map((s) => s.studentId)).size,
        avgMastery: ids.length && classTopicIds.length ? Math.round((100 * mastered) / (ids.length * classTopicIds.length)) : 0,
        classroomLinked: !!c.classroomCourseId,
      });
    }
    const totalCells = classRows.reduce((s, c) => s + c.students, 0);
    const avgMastery = totalCells ? Math.round(classRows.reduce((s, c) => s + c.avgMastery * c.students, 0) / totalCells) : 0;
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    return {
      school: { id: school.id, name: school.name, city: school.city, schoolCode: school.schoolCode, settings: school.settings },
      kpis: {
        activeStudentsWeek: activeSet.size,
        totalStudents: studentIds.length,
        missionsValidated,
        missionsValidatedWeek,
        avgMastery,
        parentParticipation: studentIds.length ? Math.round((100 * withParent.length) / studentIds.length) : 0,
        pendingMembers: pending,
      },
      trend,
      classes: classRows,
      coverage,
      classList: classes.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  async parent(a: AuthContext, studentId: string) {
    await this.actors.assert(a, 'read', 'progress', { ownerId: studentId });
    const child = await this.prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true, avatarUrl: true } });
    const g = await this.gamification.me(studentId);
    const recent = await this.prisma.submission.findMany({
      where: { studentId, status: { in: ['VALIDATED', 'PEER_REVIEW', 'TEACHER_REVIEW', 'FAMILY_CONFIRM'] } },
      include: { mission: { include: { topic: { include: { subject: true } } } } },
      orderBy: [{ validatedAt: { sort: 'desc', nulls: 'first' } }, { submittedAt: 'desc' }],
      take: 8,
    });
    const enr = await this.prisma.enrollment.findMany({ where: { studentId, status: 'ACTIVE' }, include: { class: { include: { teachers: { include: { teacher: { select: { id: true, name: true } } } } } } } });
    const struggles = [];
    for (const e of enr) for (const s of await this.stuck.forClass(e.classId)) if (s.studentId === studentId) struggles.push({ topicKey: s.topicKey, topicName: s.topicName, reasons: s.reasons });
    const strengths = await this.prisma.topicProgress.findMany({ where: { studentId, state: 'MASTERED' }, include: { topic: true }, orderBy: { masteredAt: 'desc' }, take: 5 });
    return {
      child,
      level: levelInfo(g.xp),
      xp: g.xp,
      streak: g.streak,
      badges: g.badges.filter((b) => b.earned),
      classes: enr.map((e) => ({ id: e.class.id, name: e.class.name, teachers: e.class.teachers.map((t) => t.teacher) })),
      strengths: strengths.map((s) => ({ topicKey: s.topic.key, topicName: s.topic.name, bestScore: s.bestScore })),
      struggles,
      recentWork: recent.map((r) => ({
        submissionId: r.id,
        status: r.status,
        title: r.mission.title,
        subjectKey: r.mission.topic.subject.key,
        audience: r.mission.audience,
        photoUploadIds: r.photoUploadIds,
        finalScore: r.finalScore,
        at: r.validatedAt ?? r.submittedAt,
      })),
    };
  }
}
