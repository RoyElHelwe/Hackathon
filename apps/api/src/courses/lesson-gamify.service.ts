import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { I18nText, missionText, pickText, safetyPrefilter } from '@tajriba/shared';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { gamifyLesson, SKILL_ICONS } from '../ai/tasks';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { Mission, Prisma } from '../generated/prisma/client';
import { missionFromAi, MissionsService } from '../missions/missions.service';
import { PrismaService } from '../prisma/prisma.service';
import { LessonContentService, MAX_LESSON_CHARS } from './lesson-content.service';

/** Error codes stored in Lesson.gamifyError; the web shows a localized message per code. */
export type GamifyErrorCode = 'AI_UNAVAILABLE' | 'INTERRUPTED' | 'FAILED';

/**
 * A GAMIFYING lesson older than this is considered abandoned and may be restarted (a dyno restart already resets it).
 * Long: transcoding and watching up to 3 videos of 2 hours can take a while.
 */
const STALE_MS = 60 * 60 * 1000;

/** Skill map layout (pixels, like the seeded topics): a zig-zag column in Classroom post order. */
export const lessonTopicPos = (position: number) => ({ posX: 180 + (position % 2 ? 90 : -90), posY: position * 170 });

/**
 * "Gamify with AI": reads a course lesson, asks AI for one skill + missions, and stores them as a course Topic and
 * DRAFT mission templates. Runs in the background — the HTTP request returns 202 at once (Heroku's 30 s router timeout).
 */
@Injectable()
export class LessonGamifyService implements OnModuleInit {
  private readonly logger = new Logger('LessonGamify');
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly content: LessonContentService,
    private readonly missions: MissionsService,
  ) {}

  /** Background work dies with the process: lessons left GAMIFYING by a restart become FAILED (retry-able). */
  async onModuleInit() {
    await this.prisma.lesson
      .updateMany({ where: { status: 'GAMIFYING' }, data: { status: 'FAILED', gamifyError: 'INTERRUPTED' } })
      .catch((e) => this.logger.warn(`Could not reset interrupted lessons: ${e instanceof Error ? e.message : e}`));
  }

  /** Validates, flips the lesson to GAMIFYING and starts the work without waiting for it. */
  async start(a: AuthContext, lessonId: string, count = 2): Promise<{ status: 'GAMIFYING' }> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: { include: { classes: { select: { id: true } } } } } });
    if (!lesson) throw new NotFoundException();
    await this.actors.assert(a, 'write', 'course', { schoolId: lesson.course.schoolId, courseClassIds: lesson.course.classes.map((c) => c.id) });
    if (lesson.archivedAt) throw new ConflictException({ message: 'This lesson was removed from Google Classroom.' });
    const flipped = await this.prisma.lesson.updateMany({
      where: { id: lessonId, OR: [{ status: { not: 'GAMIFYING' } }, { updatedAt: { lt: new Date(Date.now() - STALE_MS) } }] },
      data: { status: 'GAMIFYING', gamifyError: null },
    });
    if (!flipped.count) throw new ConflictException({ message: 'Arzino is already reading this lesson.', code: 'GAMIFYING' });
    const locale = a.user.locale || 'en';
    const job = this.run(lessonId, { teacherId: a.userId, locale, count }).finally(() => this.running.delete(lessonId));
    this.running.set(lessonId, job);
    return { status: 'GAMIFYING' };
  }

  /** Resolves when every background gamification has finished (tests, graceful shutdown). */
  async idle() {
    while (this.running.size) await Promise.allSettled([...this.running.values()]);
  }

  /** Does the work. Never throws: failures set the lesson FAILED with an error code. */
  async run(lessonId: string, opts: { teacherId: string; locale?: string; count?: number }): Promise<void> {
    try {
      await this.gamify(lessonId, opts);
    } catch (e) {
      const code: GamifyErrorCode = e instanceof AiUnavailableError ? 'AI_UNAVAILABLE' : 'FAILED';
      this.logger.warn(`Gamify failed for lesson ${lessonId}: ${e instanceof Error ? e.message : e}`);
      await this.prisma.lesson.updateMany({ where: { id: lessonId }, data: { status: 'FAILED', gamifyError: code } }).catch(() => undefined);
    }
  }

  private async gamify(lessonId: string, opts: { teacherId: string; locale?: string; count?: number }) {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: { course: { include: { subject: true, school: true } } },
    });
    const { course } = lesson;
    const locale = opts.locale || 'en';
    const count = Math.min(3, Math.max(1, opts.count ?? 2));
    const content = await this.content.collect(lessonId, { locale });
    // Saved before the AI call so the teacher sees what could be read even when gamifying fails.
    await this.prisma.lesson.update({ where: { id: lessonId }, data: { contentReport: content.report as unknown as Prisma.InputJsonValue, contentText: content.text.slice(0, MAX_LESSON_CHARS) } });
    const out = await this.ai.run(
      gamifyLesson,
      {
        subject: pickText(course.subject.name as I18nText, 'en'),
        grade: course.gradeLevel,
        lessonTitle: lesson.title,
        content: content.text,
        city: course.school.city,
        locale,
        count,
      },
      // "Regenerate" must give new missions even when the content did not change.
      { fresh: true },
    );
    const icon = (SKILL_ICONS as readonly string[]).includes(out.skill.icon) ? out.skill.icon : 'star';
    const skill = {
      name: { en: out.skill.name.en.trim(), ar: out.skill.name.ar.trim() || out.skill.name.en.trim() },
      description: { en: out.skill.description.en.trim(), ar: out.skill.description.ar.trim() || out.skill.description.en.trim() },
    };

    const created: Mission[] = await this.prisma.$transaction(async (tx) => {
      const topic = await tx.topic.upsert({
        where: { lessonId },
        create: {
          subjectId: course.subjectId,
          courseId: course.id,
          lessonId,
          key: `l_${lessonId}`,
          name: skill.name,
          description: skill.description,
          icon,
          gradeLevel: course.gradeLevel,
          ...lessonTopicPos(lesson.position),
        },
        update: { subjectId: course.subjectId, courseId: course.id, name: skill.name, description: skill.description, icon, gradeLevel: course.gradeLevel, ...lessonTopicPos(lesson.position) },
      });
      await this.relinkChain(tx, course.id);
      // Regenerate: replace this lesson's drafts only; approved/archived missions (and their copies) stay.
      await tx.mission.deleteMany({ where: { topicId: topic.id, courseId: course.id, classId: null, status: 'DRAFT' } });
      const missions: Mission[] = [];
      for (const m of out.missions.slice(0, count)) {
        const issues = safetyPrefilter(missionText(m));
        missions.push(
          await tx.mission.create({
            data: {
              ...missionFromAi(m, locale),
              topicId: topic.id,
              courseId: course.id,
              classId: null,
              createdById: opts.teacherId,
              status: 'DRAFT',
              audience: 'STUDENT',
              aiGenerated: true,
              safetyCheck: issues.length ? { safe: false, issues, source: 'prefilter' } : Prisma.DbNull,
            },
          }),
        );
      }
      return missions;
    });
    // Same AI safety check as the mission studio, so the review screen shows the badge right away.
    for (const m of created) await this.missions.runSafety(m.id).catch(() => undefined);
    await this.prisma.lesson.update({ where: { id: lessonId }, data: { status: 'READY', gamifyError: null, contentChangedAt: null } });
  }

  /**
   * Unlock order = Classroom post order: each lesson skill of the course requires the skill of the nearest earlier
   * gamified lesson. Skills of lessons removed from Classroom keep their links (student progress stays).
   */
  private async relinkChain(tx: Prisma.TransactionClient, courseId: string) {
    const topics = await tx.topic.findMany({
      where: { courseId, lesson: { archivedAt: null } },
      include: { lesson: { select: { position: true, postedAt: true } }, prerequisites: true },
    });
    topics.sort((x, y) => x.lesson!.position - y.lesson!.position || x.lesson!.postedAt.getTime() - y.lesson!.postedAt.getTime());
    for (let i = 0; i < topics.length; i++) {
      const want = i > 0 ? topics[i - 1].id : null;
      const have = topics[i].prerequisites.map((p) => p.prerequisiteId);
      if (have.length === (want ? 1 : 0) && (!want || have[0] === want)) continue;
      await tx.topicPrerequisite.deleteMany({ where: { topicId: topics[i].id } });
      if (want) await tx.topicPrerequisite.create({ data: { topicId: topics[i].id, prerequisiteId: want } });
    }
  }
}
