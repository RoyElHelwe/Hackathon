import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  attemptEndsAt,
  canSeeExamScore,
  effectiveExamStatus,
  ExamMood,
  ExamPhase,
  ExamQuestion,
  ExamReport,
  I18nText,
  InterviewTurnOutput,
  MAX_FOLLOW_UPS,
  MOOD_EMOJI,
  pickText,
  prepareExamOutput,
  WRAP_UP_SECONDS,
} from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { examMaxTokens, examReport, interviewTurn } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { SessionLogService } from '../realtime/session-log.service';

type AttemptWithExam = Prisma.ExamAttemptGetPayload<{ include: { exam: true } }>;

export interface TurnView {
  idx: number;
  role: 'AI' | 'STUDENT';
  text: string;
  emoji: string | null;
  mood: string | null;
  questionId: string | null;
  at: Date;
  /** teacher-only */
  eval?: unknown;
}

const LINES = {
  en: {
    hello: (n: number, min: number) => `Hi! I'm Bousla 👋 We'll talk for about ${min} minutes — ${n} questions. Take your time and think out loud. Ready? Here's the first one:`,
    bye: "That's all my questions! You did great. Your teacher will share your results soon. 🎉",
    goOn: "Thanks for sharing that! Let's keep going.",
    timeUp: "Time's up! Thanks for talking with me — your teacher will share your results soon.",
  },
  ar: {
    hello: (n: number, min: number) => `مرحباً! أنا بوصلة 👋 سنتحدث لمدة ${min} دقائق تقريباً — ${n} أسئلة. خذ وقتك وفكّر بصوت عالٍ. جاهز؟ إليك السؤال الأول:`,
    bye: 'انتهت أسئلتي! أحسنت كثيراً. سيشاركك معلمك النتيجة قريباً. 🎉',
    goOn: 'شكراً لمشاركتك! لنكمل.',
    timeUp: 'انتهى الوقت! شكراً لحديثك معي — سيشاركك معلمك النتيجة قريباً.',
  },
};
const lines = (locale: string) => (locale === 'ar' ? LINES.ar : LINES.en);

/** How long finishing/grading waits for an answer that is still being evaluated (the AI call times out at 20 s). */
const INFLIGHT_WAIT_MS = 25_000;

/**
 * The private AI interview room. The server owns the clock (`endsAt`), the question order and every turn, so a reload
 * or a dropped connection simply resumes. Scores are stored on turns/attempts and only shaped out to students after the
 * teacher releases them.
 */
@Injectable()
export class ExamRoomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ExamRoom');
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly busy = new Set<string>();
  /** answer evaluations in progress, per attempt: finishing and grading wait for them */
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly grading = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly bus: RealtimeBus,
    private readonly sessionLog: SessionLogService,
  ) {}

  /** After a restart: re-arm timers, finish overdue attempts and re-grade interrupted ones. */
  async onModuleInit() {
    try {
      const live = await this.prisma.examAttempt.findMany({ where: { status: { in: ['IN_PROGRESS', 'GRADING'] } }, select: { id: true, status: true, endsAt: true } });
      for (const a of live) {
        if (a.status === 'GRADING') this.startGrading(a.id);
        else if (a.endsAt) this.arm(a.id, a.endsAt);
      }
    } catch (e) {
      this.logger.warn(`Could not restore exam timers: ${e instanceof Error ? e.message : e}`);
    }
  }

  onModuleDestroy() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  async idle() {
    while (this.grading.size) await Promise.allSettled([...this.grading.values()]);
  }

  // ---------- student actions ----------

  async state(a: AuthContext, attemptId: string) {
    const att = await this.load(a, attemptId, 'read');
    return this.view(a, att);
  }

  async start(a: AuthContext, attemptId: string) {
    const att = await this.load(a, attemptId, 'write');
    if (att.status === 'IN_PROGRESS') return this.view(a, att);
    if (att.status !== 'NOT_STARTED') throw new ConflictException({ message: 'You already finished this exam.', code: 'FINISHED' });
    const now = new Date();
    const status = effectiveExamStatus({ status: att.exam.status as ExamPhase, opensAt: att.exam.opensAt, closesAt: att.exam.closesAt }, now);
    if (status !== 'OPEN') {
      throw new ConflictException({ message: status === 'SCHEDULED' ? 'This exam has not opened yet.' : 'This exam is closed.', code: status === 'SCHEDULED' ? 'NOT_OPEN' : 'CLOSED' });
    }
    const bank = this.bank(att);
    const endsAt = attemptEndsAt(now, att.exam.durationMin, att.exam.closesAt);
    const flipped = await this.prisma.examAttempt.updateMany({
      where: { id: attemptId, status: 'NOT_STARTED' },
      data: { status: 'IN_PROGRESS', startedAt: now, endsAt, questionIdx: 0, followUps: 0 },
    });
    if (flipped.count) {
      const L = lines(att.exam.locale);
      const first = bank[0];
      await this.addTurn(attemptId, { role: 'AI', text: `${L.hello(bank.length, att.exam.durationMin)} ${first.text}`, emoji: '👋', mood: 'calm', questionId: first.id });
      this.arm(attemptId, endsAt);
      await this.sessionLog.log('EXAM', attemptId, a.userId, 'STARTED', { endsAt });
      this.bus.toRoom(`exam:${attemptId}`, 'exam:status', { attemptId, status: 'IN_PROGRESS', endsAt });
    }
    return this.view(a, await this.reload(attemptId));
  }

  /** One spoken answer → AI assessment + empathetic reaction + next step. Retries reuse an unanswered student turn. */
  async answer(a: AuthContext, attemptId: string, text: string) {
    const att = await this.load(a, attemptId, 'write');
    if (att.status !== 'IN_PROGRESS') throw new ConflictException({ message: 'This exam is not running.', code: 'NOT_RUNNING' });
    const now = new Date();
    if (att.endsAt && now >= att.endsAt) {
      await this.finish(attemptId, 'TIME_UP');
      return this.view(a, await this.reload(attemptId));
    }
    if (this.busy.has(attemptId)) throw new ConflictException({ message: 'Bousla is still thinking about your last answer.', code: 'BUSY' });
    this.busy.add(attemptId);
    const job = this.evaluate(a, att, text, now);
    this.inflight.set(attemptId, job);
    try {
      return await job;
    } finally {
      this.inflight.delete(attemptId);
      this.busy.delete(attemptId);
    }
  }

  private async evaluate(a: AuthContext, att: AttemptWithExam, text: string, now: Date) {
    const attemptId = att.id;
    const bank = this.bank(att);
    const q = bank[Math.min(att.questionIdx, bank.length - 1)];
    const turns = await this.prisma.examTurn.findMany({ where: { attemptId }, orderBy: { idx: 'asc' } });
    const last = turns[turns.length - 1];
    // Retry after an AI failure: the previous answer is still waiting for a reply — replace its text.
    const studentTurn =
      last?.role === 'STUDENT'
        ? await this.prisma.examTurn.update({ where: { id: last.id }, data: { text, at: now } })
        : await this.addTurn(attemptId, { role: 'STUDENT', text, questionId: q.id });
    // Spectating teachers get the scored view through the teacher endpoints; the room (student included) never sees evals.
    this.bus.toRoom(`exam:${attemptId}`, 'exam:turn', { attemptId, turn: this.turnView(studentTurn, false) });

    const secondsLeft = att.endsAt ? (att.endsAt.getTime() - now.getTime()) / 1000 : 600;
    const isLast = att.questionIdx >= bank.length - 1;
    const history = [...turns.filter((t) => t.id !== studentTurn.id), studentTurn].slice(-6).map((t) => ({ role: t.role as 'AI' | 'STUDENT', text: t.text }));
    const subject = await this.subjectName(att);
    const L = lines(att.exam.locale);
    let out: InterviewTurnOutput;
    let scored = true;
    try {
      out = await this.ai.run(interviewTurn, {
        locale: att.exam.locale,
        subject,
        question: { text: q.text, expectedPoints: q.expectedPoints, followUp: q.followUp },
        answer: text,
        recentTurns: history,
        followUpsUsed: att.followUps,
        maxFollowUps: MAX_FOLLOW_UPS,
        isLastQuestion: isLast,
        secondsLeft,
      });
    } catch (e) {
      // AI down or slow: never stall the interview. Move on deterministically; this turn stays unscored (the report counts it as missing evidence).
      this.logger.warn(`Interview turn AI failed for ${attemptId}, continuing without a score: ${e instanceof Error ? e.message : e}`);
      scored = false;
      out = { assessment: { score: 0, understood: false, notes: '' }, mood: 'calm', emoji: MOOD_EMOJI.calm, reaction: L.goOn, next: isLast ? 'FINISH' : 'NEXT_QUESTION' };
    }
    if (scored) {
      const score = Math.round(out.assessment.score * 10) / 10;
      await this.prisma.examTurn.update({ where: { id: studentTurn.id }, data: { eval: { ...out.assessment, score } as Prisma.InputJsonValue, mood: out.mood } });
    }
    // The interview may have ended while the AI was thinking (timer, window closed): keep the assessment, add no new questions.
    const current = await this.prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (current?.status !== 'IN_PROGRESS') return this.view(a, await this.reload(attemptId));

    const mood = out.mood as ExamMood;
    const emoji = out.emoji || MOOD_EMOJI[mood];
    const timeLow = secondsLeft <= WRAP_UP_SECONDS;
    if (!timeLow && out.next === 'FOLLOW_UP' && att.followUps < MAX_FOLLOW_UPS && (out.followUpQuestion || q.followUp)) {
      await this.prisma.examAttempt.update({ where: { id: attemptId }, data: { followUps: { increment: 1 } } });
      await this.addTurn(attemptId, { role: 'AI', text: `${out.reaction} ${out.followUpQuestion || q.followUp}`, emoji, mood, questionId: q.id });
    } else if (!timeLow && !isLast) {
      // The model may say FINISH early; questions are left and there is time, so the interview goes on.
      const next = bank[att.questionIdx + 1];
      await this.prisma.examAttempt.update({ where: { id: attemptId }, data: { questionIdx: att.questionIdx + 1, followUps: 0 } });
      await this.addTurn(attemptId, { role: 'AI', text: `${out.reaction} ${next.text}`, emoji, mood, questionId: next.id });
    } else {
      await this.addTurn(attemptId, { role: 'AI', text: `${out.reaction} ${timeLow ? L.timeUp : L.bye}`, emoji: '🎉', mood, questionId: null });
      await this.finishNow(attemptId, timeLow ? 'TIME_UP' : 'COMPLETED');
    }
    return this.view(a, await this.reload(attemptId));
  }

  /** "I'm done" from the student. */
  async finishByStudent(a: AuthContext, attemptId: string) {
    const att = await this.load(a, attemptId, 'write');
    if (att.status === 'IN_PROGRESS') await this.finish(attemptId, 'STUDENT_FINISHED');
    return this.view(a, await this.reload(attemptId));
  }

  // ---------- lifecycle ----------

  /** Waits (bounded) for an answer of this attempt that is still being evaluated. */
  private async settle(attemptId: string) {
    const job = this.inflight.get(attemptId);
    if (!job) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([job.catch(() => undefined), new Promise((r) => (timer = setTimeout(r, INFLIGHT_WAIT_MS)))]);
    clearTimeout(timer);
  }

  /** Ends the interview once (IN_PROGRESS → GRADING) and grades it in the background. A late answer is evaluated first. */
  async finish(attemptId: string, reason: string): Promise<boolean> {
    await this.settle(attemptId);
    return this.finishNow(attemptId, reason);
  }

  private async finishNow(attemptId: string, reason: string): Promise<boolean> {
    const flipped = await this.prisma.examAttempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: { status: 'GRADING', finishedAt: new Date(), finishReason: reason },
    });
    const t = this.timers.get(attemptId);
    if (t) clearTimeout(t);
    this.timers.delete(attemptId);
    if (!flipped.count) return false;
    if (reason === 'TIME_UP' || reason === 'WINDOW_CLOSED') {
      const att = await this.reload(attemptId);
      const turns = await this.prisma.examTurn.count({ where: { attemptId } });
      const last = await this.prisma.examTurn.findFirst({ where: { attemptId }, orderBy: { idx: 'desc' } });
      if (turns && last?.questionId !== null) {
        await this.addTurn(attemptId, { role: 'AI', text: lines(att.exam.locale).timeUp, emoji: '⏰', mood: 'calm', questionId: null });
      }
    }
    await this.sessionLog.log('EXAM', attemptId, null, 'FINISHED', { reason });
    this.bus.toRoom(`exam:${attemptId}`, 'exam:status', { attemptId, status: 'GRADING', reason });
    this.startGrading(attemptId);
    return true;
  }

  /** Cron / timers: finish attempts whose time is over. */
  async finishOverdue(now = new Date()): Promise<number> {
    const due = await this.prisma.examAttempt.findMany({ where: { status: 'IN_PROGRESS', endsAt: { lte: now } }, select: { id: true } });
    let n = 0;
    for (const d of due) if (await this.finish(d.id, 'TIME_UP')) n++;
    return n;
  }

  private arm(attemptId: string, endsAt: Date) {
    const old = this.timers.get(attemptId);
    if (old) clearTimeout(old);
    const ms = Math.max(0, endsAt.getTime() - Date.now()) + 500;
    const t = setTimeout(() => {
      this.timers.delete(attemptId);
      void this.finish(attemptId, 'TIME_UP').catch((e) => this.logger.warn(`Timer finish failed: ${e instanceof Error ? e.message : e}`));
    }, Math.min(ms, 2_147_000_000));
    t.unref?.();
    this.timers.set(attemptId, t);
  }

  private startGrading(attemptId: string) {
    if (this.grading.has(attemptId)) return;
    const job = this.grade(attemptId)
      .catch((e) => this.logger.warn(`Grading failed for ${attemptId}: ${e instanceof Error ? e.message : e}`))
      .finally(() => this.grading.delete(attemptId));
    this.grading.set(attemptId, job);
  }

  /** AI report; if the AI is down the deterministic report (from per-answer scores) is used so the teacher is never blocked. */
  private async grade(attemptId: string) {
    await this.settle(attemptId);
    const att = await this.reload(attemptId);
    if (att.status !== 'GRADING') return;
    const bank = this.bank(att);
    const turns = await this.prisma.examTurn.findMany({ where: { attemptId }, orderBy: { idx: 'asc' } });
    const input = {
      locale: att.exam.locale,
      subject: await this.subjectName(att),
      questions: bank.map((q) => ({ id: q.id, text: q.text })),
      turns: turns.map((t) => ({ role: t.role as 'AI' | 'STUDENT', text: t.text, questionId: t.questionId, score: (t.eval as { score?: number } | null)?.score ?? null })),
      finishReason: att.finishReason ?? 'COMPLETED',
    };
    let report: ExamReport;
    let fallback = false;
    try {
      report = await this.ai.run(examReport, input, { maxTokens: examMaxTokens(bank.length, examReport.maxTokens) });
    } catch {
      report = examReport.mock(input);
      fallback = true;
    }
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { status: 'GRADED', aiScore: report.score, aiReport: { ...report, fallback } as Prisma.InputJsonValue },
    });
    const teachers = await this.prisma.classTeacher.findMany({ where: { classId: att.exam.classId }, select: { teacherId: true } });
    for (const t of teachers) this.bus.toUser(t.teacherId, 'exam:graded', { examId: att.examId, attemptId });
    this.bus.toRoom(`exam:${attemptId}`, 'exam:status', { attemptId, status: 'GRADED' });
  }

  // ---------- views ----------

  /** Student/teacher/parent view of one attempt. Scores and AI notes only for those allowed to see them. */
  async view(a: AuthContext, att: AttemptWithExam) {
    const actor = await this.actors.actor(a);
    const released = att.status === 'RELEASED';
    const seeScore = canSeeExamScore(actor, { classId: att.exam.classId, ownerId: att.studentId, released });
    const isStaff = actor.role === 'TEACHER' || actor.role === 'DIRECTOR' || actor.role === 'ADMIN';
    const bank = this.bank(att);
    const turns = await this.prisma.examTurn.findMany({ where: { attemptId: att.id }, orderBy: { idx: 'asc' } });
    const report = att.aiReport as (ExamReport & { fallback?: boolean }) | null;
    const now = Date.now();
    const student = isStaff ? await this.prisma.user.findUnique({ where: { id: att.studentId }, select: { name: true } }) : null;
    return {
      id: att.id,
      examId: att.examId,
      studentId: att.studentId,
      studentName: student?.name,
      status: att.status,
      room: `exam:${att.id}`,
      exam: {
        id: att.exam.id,
        title: att.exam.title,
        locale: att.exam.locale,
        durationMin: att.exam.durationMin,
        opensAt: att.exam.opensAt,
        closesAt: att.exam.closesAt,
        status: effectiveExamStatus({ status: att.exam.status as ExamPhase, opensAt: att.exam.opensAt, closesAt: att.exam.closesAt }),
      },
      questionIdx: att.questionIdx,
      questionCount: bank.length,
      startedAt: att.startedAt,
      endsAt: att.endsAt,
      secondsLeft: att.status === 'IN_PROGRESS' && att.endsAt ? Math.max(0, Math.round((att.endsAt.getTime() - now) / 1000)) : null,
      finishedAt: att.finishedAt,
      finishReason: att.finishReason,
      thinking: this.busy.has(att.id),
      turns: turns.map((t) => this.turnView(t, isStaff)),
      result: seeScore
        ? {
            score: att.teacherScore ?? att.aiScore,
            aiScore: att.aiScore,
            teacherScore: att.teacherScore,
            teacherComment: att.teacherComment,
            feedback: report?.studentFeedback ?? null,
            strengths: report?.strengths ?? [],
            gaps: report?.gaps ?? [],
            ...(isStaff ? { report, approvedAt: att.approvedAt } : {}),
          }
        : null,
      ...(isStaff ? { questions: bank, spectators: this.bus.spectators(`exam:${att.id}`).length, online: this.bus.presence.connected(`exam:${att.id}`).some((p) => !p.spectator) } : {}),
    };
  }

  turnView(t: { idx: number; role: string; text: string; emoji: string | null; mood: string | null; questionId: string | null; at: Date; eval: unknown }, staff: boolean): TurnView {
    return {
      idx: t.idx,
      role: t.role as 'AI' | 'STUDENT',
      text: t.text,
      emoji: t.emoji,
      mood: t.mood,
      questionId: t.questionId,
      at: t.at,
      ...(staff && t.eval ? { eval: t.eval } : {}),
    };
  }

  // ---------- helpers ----------

  private async addTurn(attemptId: string, t: { role: 'AI' | 'STUDENT'; text: string; emoji?: string; mood?: string; questionId: string | null }) {
    const last = await this.prisma.examTurn.findFirst({ where: { attemptId }, orderBy: { idx: 'desc' }, select: { idx: true } });
    const turn = await this.prisma.examTurn.create({
      data: { attemptId, idx: (last?.idx ?? -1) + 1, role: t.role, text: t.text, emoji: t.emoji ?? null, mood: t.mood ?? null, questionId: t.questionId },
    });
    if (t.role === 'AI') {
      this.bus.toRoom(`exam:${attemptId}`, 'exam:turn', { attemptId, turn: this.turnView(turn, false) });
      await this.sessionLog.log('EXAM', attemptId, null, 'AI_TURN', { idx: turn.idx, emoji: t.emoji, mood: t.mood });
    } else {
      await this.sessionLog.log('EXAM', attemptId, null, 'STUDENT_TURN', { idx: turn.idx });
    }
    return turn;
  }

  private bank(att: AttemptWithExam): ExamQuestion[] {
    const parsed = prepareExamOutput.safeParse(att.exam.questionBank);
    if (!parsed.success || !parsed.data.questions.length) throw new ConflictException({ message: 'This exam has no questions yet.', code: 'NO_QUESTIONS' });
    return parsed.data.questions;
  }

  private async subjectName(att: AttemptWithExam): Promise<string> {
    const cls = await this.prisma.class.findUnique({ where: { id: att.exam.classId }, include: { subject: true } });
    return cls?.subject ? pickText(cls.subject.name as I18nText, 'en') : cls?.name ?? '';
  }

  private reload(attemptId: string) {
    return this.prisma.examAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { exam: true } });
  }

  private async load(a: AuthContext, attemptId: string, action: 'read' | 'write') {
    const att = await this.prisma.examAttempt.findUnique({ where: { id: attemptId }, include: { exam: true } });
    if (!att) throw new NotFoundException();
    await this.actors.assert(a, action, 'exam_attempt', {
      schoolId: att.exam.schoolId,
      classId: att.exam.classId,
      ownerId: att.studentId,
      released: att.status === 'RELEASED',
    });
    if (action === 'write' && att.studentId !== a.userId) throw new ForbiddenException('You do not have access to this.');
    return att;
  }
}
