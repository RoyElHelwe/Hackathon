import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateExamBody, effectiveExamStatus, ExamPhase, prepareExamOutput, UpdateExamBody } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { GamificationService } from '../gamification/gamification.service';
import { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { ExamPrepService } from './exam-prep.service';
import { ExamRoomService } from './exam-room.service';

export const EXAM_XP = 40;

const examInclude = {
  lessons: { include: { lesson: { select: { id: true, title: true, position: true } } } },
  class: { select: { id: true, name: true, schoolId: true, courseId: true } },
} as const;

/** Teacher side of AI interview exams: create → AI prepares questions → edit → publish → live grid → review & release. */
@Injectable()
export class ExamsService {
  private readonly logger = new Logger('Exams');

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly prep: ExamPrepService,
    private readonly room: ExamRoomService,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
    private readonly bus: RealtimeBus,
  ) {}

  async create(a: AuthContext, body: CreateExamBody) {
    const cls = await this.prisma.class.findUnique({ where: { id: body.classId }, select: { id: true, schoolId: true, courseId: true } });
    if (!cls) throw new NotFoundException();
    await this.actors.assert(a, 'write', 'exam', { schoolId: cls.schoolId, classId: cls.id });
    const lessonIds = [...new Set(body.lessonIds)];
    const lessons = await this.prisma.lesson.findMany({ where: { id: { in: lessonIds }, archivedAt: null, courseId: cls.courseId ?? '__none__' }, select: { id: true } });
    if (lessons.length !== lessonIds.length) throw new BadRequestException({ message: "Pick lessons from this class's course.", code: 'BAD_LESSONS' });
    const exam = await this.prisma.exam.create({
      data: {
        schoolId: cls.schoolId,
        classId: cls.id,
        createdById: a.userId,
        title: body.title,
        locale: body.locale,
        durationMin: body.durationMin,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        lessons: { create: lessonIds.map((lessonId) => ({ lessonId })) },
      },
    });
    await this.prep.start(exam.id);
    return this.detail(a, exam.id);
  }

  /** Regenerate the questions (AI reads the lessons again). */
  async prepare(a: AuthContext, id: string) {
    const exam = await this.load(a, id, 'write');
    if (exam.status === 'PREPARING') throw new ConflictException({ message: 'Arzino is already preparing this exam.', code: 'PREPARING' });
    if (!['DRAFT', 'READY', 'FAILED'].includes(exam.status)) throw new ConflictException({ message: 'This exam is already published.', code: 'PUBLISHED' });
    await this.prep.start(id);
    return this.detail(a, id);
  }

  async update(a: AuthContext, id: string, body: UpdateExamBody) {
    const exam = await this.load(a, id, 'write');
    const editable = ['DRAFT', 'READY', 'FAILED'].includes(exam.status) || (exam.status === 'SCHEDULED' && exam.opensAt > new Date());
    if (!editable) throw new ConflictException({ message: 'The exam already started; it can no longer be edited.', code: 'LOCKED' });
    const opensAt = body.opensAt ?? exam.opensAt;
    const closesAt = body.closesAt ?? exam.closesAt;
    if (closesAt <= opensAt) throw new BadRequestException({ message: 'The exam must close after it opens.' });
    const data: Prisma.ExamUpdateInput = { title: body.title, durationMin: body.durationMin, opensAt: body.opensAt, closesAt: body.closesAt };
    if (body.questions) {
      const questions = body.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
      data.questionBank = prepareExamOutput.parse({ questions }) as Prisma.InputJsonValue;
    }
    await this.prisma.exam.update({ where: { id }, data });
    return this.detail(a, id);
  }

  /** Creates one private room (attempt) per active student and notifies them. Idempotent. */
  async publish(a: AuthContext, id: string) {
    const exam = await this.load(a, id, 'write');
    if (exam.status === 'SCHEDULED' || exam.status === 'OPEN') return this.detail(a, id);
    if (exam.status !== 'READY') throw new ConflictException({ message: 'Prepare the questions first.', code: 'NOT_READY' });
    if (!prepareExamOutput.safeParse(exam.questionBank).success) throw new ConflictException({ message: 'Prepare the questions first.', code: 'NOT_READY' });
    if (exam.closesAt <= new Date()) throw new BadRequestException({ message: 'The exam window is already over. Change the dates first.', code: 'WINDOW_OVER' });
    const students = await this.prisma.enrollment.findMany({ where: { classId: exam.classId, status: 'ACTIVE' }, select: { studentId: true }, orderBy: { student: { name: 'asc' } } });
    await this.prisma.$transaction(async (tx) => {
      let room = 1;
      for (const s of students) {
        await tx.examAttempt.upsert({
          where: { examId_studentId: { examId: id, studentId: s.studentId } },
          update: {},
          create: { examId: id, studentId: s.studentId, roomIndex: room },
        });
        room++;
      }
      await tx.exam.update({ where: { id }, data: { status: 'SCHEDULED' } });
    });
    const payload = { examId: id, title: exam.title, opensAt: exam.opensAt, closesAt: exam.closesAt, durationMin: exam.durationMin };
    await this.notifications.notifyMany(students.map((s) => s.studentId), 'EXAM_SCHEDULED', payload, `exam-scheduled:${id}`);
    for (const s of students) this.bus.toUser(s.studentId, 'exam:scheduled', payload);
    await this.tick();
    return this.detail(a, id);
  }

  async list(a: AuthContext, classId?: string) {
    const actor = await this.actors.actor(a);
    const isAdmin = actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
    if (classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
      if (!cls) throw new NotFoundException();
      await this.actors.assert(a, 'read', 'exam', { schoolId: cls.schoolId, classId });
    }
    const where: Prisma.ExamWhereInput = {
      schoolId: actor.schoolId,
      ...(classId ? { classId } : isAdmin ? {} : { classId: { in: actor.classIdsTaught ?? [] } }),
    };
    const exams = await this.prisma.exam.findMany({ where, include: { class: { select: { name: true } }, attempts: { select: { status: true } } }, orderBy: { opensAt: 'desc' }, take: 100 });
    return exams.map((e) => ({
      id: e.id,
      title: e.title,
      classId: e.classId,
      className: e.class.name,
      status: effectiveExamStatus({ status: e.status as ExamPhase, opensAt: e.opensAt, closesAt: e.closesAt }),
      prepError: e.prepError,
      durationMin: e.durationMin,
      opensAt: e.opensAt,
      closesAt: e.closesAt,
      counts: countStatuses(e.attempts.map((x) => x.status)),
    }));
  }

  /** Teacher: full exam with questions and the live room grid. Student: their own room, no questions. */
  async detail(a: AuthContext, id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, include: examInclude });
    if (!exam) throw new NotFoundException();
    await this.actors.assert(a, 'read', 'exam', { schoolId: exam.schoolId, classId: exam.classId });
    const actor = await this.actors.actor(a);
    const status = effectiveExamStatus({ status: exam.status as ExamPhase, opensAt: exam.opensAt, closesAt: exam.closesAt });
    const base = {
      id: exam.id,
      title: exam.title,
      classId: exam.classId,
      className: exam.class.name,
      locale: exam.locale,
      durationMin: exam.durationMin,
      opensAt: exam.opensAt,
      closesAt: exam.closesAt,
      status,
      lessons: exam.lessons.map((l) => l.lesson).sort((x, y) => x.position - y.position).map((l) => ({ id: l.id, title: l.title })),
    };
    if (actor.role === 'STUDENT') {
      const att = await this.prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: a.userId } }, select: { id: true, status: true } });
      return { ...base, questionCount: prepareExamOutput.safeParse(exam.questionBank).data?.questions.length ?? 0, attempt: att };
    }
    const bank = prepareExamOutput.safeParse(exam.questionBank);
    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId: id },
      include: { student: { select: { id: true, name: true, avatarUrl: true } }, turns: { where: { role: 'AI' }, orderBy: { idx: 'desc' }, take: 1 } },
      orderBy: { roomIndex: 'asc' },
    });
    return {
      ...base,
      prepError: exam.prepError,
      questions: bank.success ? bank.data.questions : [],
      resultsReleasedAt: exam.resultsReleasedAt,
      canEdit: actor.role === 'TEACHER' && (['DRAFT', 'READY', 'FAILED'].includes(status) || (status === 'SCHEDULED' && exam.opensAt > new Date())),
      counts: countStatuses(attempts.map((x) => x.status)),
      attempts: attempts.map((t) => ({
        id: t.id,
        roomIndex: t.roomIndex,
        student: t.student,
        status: t.status,
        questionIdx: t.questionIdx,
        startedAt: t.startedAt,
        endsAt: t.endsAt,
        finishedAt: t.finishedAt,
        aiScore: t.aiScore,
        teacherScore: t.teacherScore,
        score: t.teacherScore ?? t.aiScore,
        lastEmoji: t.turns[0]?.emoji ?? null,
        lastMood: t.turns[0]?.mood ?? null,
        online: this.bus.presence.connected(`exam:${t.id}`).some((p) => !p.spectator),
        spectators: this.bus.spectators(`exam:${t.id}`).length,
      })),
    };
  }

  /** Teacher review: optional score override + comment; `release` shows the result to the student (and parents). */
  async review(a: AuthContext, attemptId: string, body: { score?: number; comment?: string; release: boolean }) {
    const att = await this.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true } });
    if (!att) throw new NotFoundException();
    await this.actors.assert(a, 'review', 'exam_attempt', { schoolId: att.exam.schoolId, classId: att.exam.classId, ownerId: att.studentId });
    if (att.status !== 'GRADED' && att.status !== 'RELEASED') throw new ConflictException({ message: 'Wait until the interview is graded.', code: 'NOT_GRADED' });
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        ...(body.score !== undefined ? { teacherScore: body.score } : {}),
        ...(body.comment !== undefined ? { teacherComment: body.comment } : {}),
        approvedById: a.userId,
        approvedAt: new Date(),
      },
    });
    if (body.release) await this.release([attemptId]);
    return this.room.view(a, await this.prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { exam: true } }));
  }

  /** Releases every graded attempt of the exam. */
  async releaseAll(a: AuthContext, examId: string) {
    const exam = await this.load(a, examId, 'write');
    const graded = await this.prisma.examAttempt.findMany({ where: { examId, status: 'GRADED' }, select: { id: true } });
    await this.prisma.examAttempt.updateMany({ where: { id: { in: graded.map((g) => g.id) }, approvedAt: null }, data: { approvedAt: new Date(), approvedById: a.userId } });
    const n = await this.release(graded.map((g) => g.id));
    await this.prisma.exam.update({ where: { id: exam.id }, data: { resultsReleasedAt: new Date() } });
    return { released: n };
  }

  private async release(attemptIds: string[]): Promise<number> {
    let n = 0;
    for (const id of attemptIds) {
      const flipped = await this.prisma.examAttempt.updateMany({ where: { id, status: 'GRADED' }, data: { status: 'RELEASED' } });
      if (!flipped.count) continue;
      n++;
      const att = await this.prisma.examAttempt.findUniqueOrThrow({ where: { id }, include: { exam: { include: { class: { select: { subjectId: true } } } } } });
      const payload = { examId: att.examId, attemptId: id, title: att.exam.title, score: att.teacherScore ?? att.aiScore };
      await this.notifications.notify(att.studentId, 'EXAM_RESULT_RELEASED', payload, `exam-released:${id}`);
      this.bus.toUser(att.studentId, 'exam:released', payload);
      const parents = await this.prisma.parentLink.findMany({ where: { studentId: att.studentId, status: 'VERIFIED' }, select: { parentId: true } });
      await this.notifications.notifyMany(parents.map((p) => p.parentId), 'EXAM_RESULT_RELEASED', { ...payload, studentId: att.studentId }, `exam-released:${id}`);
      const before = await this.gamification.totalXp(att.studentId);
      await this.gamification.addXp(att.studentId, EXAM_XP, 'EXAM_DONE', id, att.exam.class.subjectId);
      await this.gamification.levelUpCheck(att.studentId, before);
    }
    return n;
  }

  /** Student: exams of their classes that were published. */
  async mine(a: AuthContext) {
    const rows = await this.prisma.examAttempt.findMany({
      where: { studentId: a.userId, exam: { status: { in: ['SCHEDULED', 'OPEN', 'CLOSED'] } } },
      include: { exam: { include: { class: { select: { name: true } } } } },
      orderBy: { exam: { opensAt: 'desc' } },
      take: 30,
    });
    return rows.map((r) => ({
      attemptId: r.id,
      examId: r.examId,
      title: r.exam.title,
      className: r.exam.class.name,
      durationMin: r.exam.durationMin,
      opensAt: r.exam.opensAt,
      closesAt: r.exam.closesAt,
      examStatus: effectiveExamStatus({ status: r.exam.status as ExamPhase, opensAt: r.exam.opensAt, closesAt: r.exam.closesAt }),
      status: r.status,
      roomIndex: r.roomIndex,
      score: r.status === 'RELEASED' ? (r.teacherScore ?? r.aiScore) : null,
    }));
  }

  /** Parent: released exam results of a linked child. */
  async forChild(a: AuthContext, studentId: string) {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'PARENT' || !actor.childIds?.includes(studentId)) throw new ForbiddenException('You do not have access to this.');
    const rows = await this.prisma.examAttempt.findMany({ where: { studentId, status: 'RELEASED' }, include: { exam: true }, orderBy: { finishedAt: 'desc' }, take: 20 });
    return rows.map((r) => ({
      attemptId: r.id,
      title: r.exam.title,
      finishedAt: r.finishedAt,
      score: r.teacherScore ?? r.aiScore,
      teacherComment: r.teacherComment,
      feedback: (r.aiReport as { studentFeedback?: string } | null)?.studentFeedback ?? null,
    }));
  }

  /** Cron (every minute): open/close windows, mark missed rooms, finish overdue interviews. Idempotent. */
  async tick(now = new Date()): Promise<{ opened: number; closed: number; finished: number }> {
    const toOpen = await this.prisma.exam.findMany({ where: { status: 'SCHEDULED', opensAt: { lte: now }, closesAt: { gt: now } }, select: { id: true, title: true, closesAt: true } });
    for (const e of toOpen) {
      const flipped = await this.prisma.exam.updateMany({ where: { id: e.id, status: 'SCHEDULED' }, data: { status: 'OPEN' } });
      if (!flipped.count) continue;
      const students = await this.prisma.examAttempt.findMany({ where: { examId: e.id }, select: { studentId: true } });
      await this.notifications.notifyMany(students.map((s) => s.studentId), 'EXAM_OPEN', { examId: e.id, title: e.title, closesAt: e.closesAt }, `exam-open:${e.id}`);
      for (const s of students) this.bus.toUser(s.studentId, 'exam:open', { examId: e.id, title: e.title });
    }
    let finished = await this.room.finishOverdue(now);
    const toClose = await this.prisma.exam.findMany({ where: { status: { in: ['SCHEDULED', 'OPEN'] }, closesAt: { lte: now } }, select: { id: true } });
    for (const e of toClose) {
      const live = await this.prisma.examAttempt.findMany({ where: { examId: e.id, status: 'IN_PROGRESS' }, select: { id: true } });
      for (const l of live) if (await this.room.finish(l.id, 'WINDOW_CLOSED')) finished++;
      await this.prisma.examAttempt.updateMany({ where: { examId: e.id, status: 'NOT_STARTED' }, data: { status: 'MISSED' } });
      await this.prisma.exam.update({ where: { id: e.id }, data: { status: 'CLOSED' } });
    }
    return { opened: toOpen.length, closed: toClose.length, finished };
  }

  private async load(a: AuthContext, id: string, action: 'read' | 'write') {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam) throw new NotFoundException();
    await this.actors.assert(a, action, 'exam', { schoolId: exam.schoolId, classId: exam.classId });
    return exam;
  }
}

function countStatuses(statuses: string[]) {
  const c: Record<string, number> = { NOT_STARTED: 0, IN_PROGRESS: 0, GRADING: 0, GRADED: 0, RELEASED: 0, MISSED: 0 };
  for (const s of statuses) c[s] = (c[s] ?? 0) + 1;
  return { ...c, total: statuses.length };
}
