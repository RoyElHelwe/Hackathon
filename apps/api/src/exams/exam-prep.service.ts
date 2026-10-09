import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { I18nText, pickText, prepareExamOutput, questionCountFor } from '@tajriba/shared';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { examMaxTokens, prepareExam } from '../ai/tasks';
import { LessonContentService } from '../courses/lesson-content.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_EXAM_CHARS = 30_000;

/**
 * Prepares an exam's question bank in the background (AI reads the selected lessons and sizes the interview to the
 * time limit). Same pattern as LessonGamifyService: 202 + polling, never throws, interrupted jobs become FAILED.
 */
@Injectable()
export class ExamPrepService implements OnModuleInit {
  private readonly logger = new Logger('ExamPrep');
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly content: LessonContentService,
  ) {}

  async onModuleInit() {
    await this.prisma.exam
      .updateMany({ where: { status: 'PREPARING' }, data: { status: 'FAILED', prepError: 'INTERRUPTED' } })
      .catch((e) => this.logger.warn(`Could not reset interrupted exams: ${e instanceof Error ? e.message : e}`));
  }

  /** Flips the exam to PREPARING and starts the work without waiting. Returns false if it was already preparing. */
  async start(examId: string): Promise<boolean> {
    const flipped = await this.prisma.exam.updateMany({
      where: { id: examId, status: { in: ['DRAFT', 'READY', 'FAILED'] } },
      data: { status: 'PREPARING', prepError: null },
    });
    if (!flipped.count) return false;
    const job = this.run(examId).finally(() => this.running.delete(examId));
    this.running.set(examId, job);
    return true;
  }

  async idle() {
    while (this.running.size) await Promise.allSettled([...this.running.values()]);
  }

  async run(examId: string): Promise<void> {
    try {
      await this.prepare(examId);
    } catch (e) {
      const code = e instanceof AiUnavailableError ? 'AI_UNAVAILABLE' : 'FAILED';
      this.logger.warn(`Exam prep failed for ${examId}: ${e instanceof Error ? e.message : e}`);
      await this.prisma.exam.updateMany({ where: { id: examId }, data: { status: 'FAILED', prepError: code } }).catch(() => undefined);
    }
  }

  private async prepare(examId: string) {
    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      include: { lessons: { include: { lesson: true } }, class: { include: { subject: true } } },
    });
    const lessons = exam.lessons.map((l) => l.lesson).sort((a, b) => a.position - b.position);
    let content = '';
    for (const l of lessons) {
      // Stored at gamify time; otherwise a text-only read (never re-downloads or re-watches videos).
      const text =
        l.contentText ??
        (await this.content
          .collect(l.id, { textOnly: true })
          .then((c) => c.text)
          .catch(() => `${l.title}\n${l.description}`));
      content += `\n\n## ${l.title}\n${text}`;
      if (content.length > MAX_EXAM_CHARS) break;
    }
    const count = questionCountFor(exam.durationMin);
    const out = await this.ai.run(
      prepareExam,
      {
        subject: exam.class.subject ? pickText(exam.class.subject.name as I18nText, 'en') : exam.class.name,
        grade: exam.class.gradeLevel ?? 8,
        lessonTitles: lessons.map((l) => l.title),
        content: content.slice(0, MAX_EXAM_CHARS),
        count,
        durationMin: exam.durationMin,
        locale: exam.locale,
      },
      { fresh: true, maxTokens: examMaxTokens(count, prepareExam.maxTokens) },
    );
    // Stable ids q1..qN whatever the model returned.
    const questions = out.questions.slice(0, count).map((q, i) => ({ ...q, id: `q${i + 1}` }));
    const bank = prepareExamOutput.parse({ questions });
    await this.prisma.exam.update({ where: { id: examId }, data: { status: 'READY', prepError: null, questionBank: bank as Prisma.InputJsonValue } });
  }
}
