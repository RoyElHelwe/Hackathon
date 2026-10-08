import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AiMission, BASE_XP, Difficulty, I18nText, missionText, MissionAudience, pickText, safetyPrefilter } from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { generateMissions, safetyCheckMission } from '../ai/tasks';
import { ClassroomService } from '../classroom/classroom.service';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mission, Prisma } from '../generated/prisma/client';

const loc = (locale: string, text: string): I18nText => (locale === 'en' ? { en: text } : { en: text, [locale]: text });
const locList = (locale: string, list: string[]) => (locale === 'en' ? { en: list } : { en: list, [locale]: list });

export function missionFromAi(m: AiMission, locale: string) {
  return {
    title: loc(locale, m.title),
    story: loc(locale, m.story),
    steps: locList(locale, m.steps),
    miniLesson: { text: loc(locale, m.miniLesson.text), visualSpec: m.miniLesson.visualSpec },
    proofSpec: m.proofSpec,
    rubric: m.rubric,
    safetyNotes: loc(locale, m.safetyNotes),
    difficulty: m.difficulty,
    estimatedMin: m.estimatedMin,
    xpReward: BASE_XP[m.difficulty],
  };
}

@Injectable()
export class MissionsService {
  private readonly logger = new Logger('Missions');

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly classroom: ClassroomService,
    private readonly notifications: NotificationsService,
  ) {}

  private async target(m: Pick<Mission, 'classId' | 'audience' | 'status'>) {
    return { resource: m.status === 'DRAFT' ? ('mission_draft' as const) : ('mission' as const), target: { classId: m.classId, audience: m.audience } };
  }

  async assertRead(a: AuthContext, m: Mission) {
    const t = await this.target(m);
    await this.actors.assert(a, 'read', t.resource, t.target);
  }

  async assertWrite(a: AuthContext, m: Mission) {
    await this.actors.assert(a, 'write', 'mission_draft', { classId: m.classId });
  }

  async generate(a: AuthContext, body: { topicId: string; classId: string; count: number; interests?: string; audience?: MissionAudience }) {
    await this.actors.assert(a, 'write', 'mission_draft', { classId: body.classId });
    const topic = await this.prisma.topic.findUnique({ where: { id: body.topicId }, include: { subject: true } });
    if (!topic) throw new NotFoundException('Topic not found');
    const cls = await this.prisma.class.findUniqueOrThrow({ where: { id: body.classId }, include: { school: true } });
    const locale = a.user.locale || 'en';
    const out = await this.ai.run(generateMissions, {
      topicKey: topic.key,
      topicName: pickText(topic.name as I18nText, 'en'),
      subject: pickText(topic.subject.name as I18nText, 'en'),
      grade: cls.gradeLevel ?? topic.gradeLevel,
      locale,
      city: cls.school.city,
      interests: body.interests,
      count: body.count,
      audience: body.audience,
    });
    const created: Mission[] = [];
    for (const m of out.missions.slice(0, body.count)) {
      const data = missionFromAi(m, locale);
      const issues = safetyPrefilter(missionText(m));
      const mission = await this.prisma.mission.create({
        data: {
          ...data,
          topicId: topic.id,
          classId: cls.id,
          createdById: a.userId,
          status: 'DRAFT',
          audience: body.audience ?? 'STUDENT',
          aiGenerated: true,
          safetyCheck: issues.length ? { safe: false, issues, source: 'prefilter' } : Prisma.DbNull,
        },
      });
      created.push(mission);
    }
    // Run the AI safety check on each draft so the studio can show the badge right away.
    for (const m of created) await this.runSafety(m.id).catch(() => undefined);
    return this.prisma.mission.findMany({ where: { id: { in: created.map((c) => c.id) } }, include: { topic: { include: { subject: true } } } });
  }

  /** Deterministic prefilter + AI safety check. The mission is unsafe if either flags it. */
  async runSafety(missionId: string) {
    const m = await this.prisma.mission.findUniqueOrThrow({ where: { id: missionId } });
    const content = { title: m.title, story: m.story, steps: m.steps, safetyNotes: m.safetyNotes, proofSpec: m.proofSpec };
    const pre = safetyPrefilter(missionText(content));
    const ai = await this.ai.run(safetyCheckMission, { mission: content });
    const issues = [...new Set([...pre, ...ai.issues])];
    const result = { safe: ai.safe && pre.length === 0, issues, saferVersion: ai.saferVersion ?? (issues.length ? 'Do this activity on the ground, during the day, with an adult present, using only safe household items.' : undefined), checkedAt: new Date().toISOString() };
    await this.prisma.mission.update({ where: { id: missionId }, data: { safetyCheck: result } });
    return result;
  }

  async safetyCheck(a: AuthContext, id: string) {
    const m = await this.getRaw(id);
    await this.assertWrite(a, m);
    return this.runSafety(id);
  }

  async getRaw(id: string) {
    const m = await this.prisma.mission.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mission not found');
    return m;
  }

  async list(a: AuthContext, q: { classId?: string; status?: string; topicId?: string }) {
    const actor = await this.actors.actor(a);
    const where: Prisma.MissionWhereInput = {};
    if (q.topicId) where.topicId = q.topicId;
    if (actor.role === 'STUDENT') {
      where.classId = { in: q.classId ? actor.classIdsEnrolled!.filter((c) => c === q.classId) : actor.classIdsEnrolled! };
      where.status = 'APPROVED';
    } else if (actor.role === 'PARENT') {
      where.classId = { in: actor.childClassIds! };
      where.status = 'APPROVED';
      where.audience = 'FAMILY';
    } else if (actor.role === 'TEACHER') {
      where.classId = { in: q.classId ? actor.classIdsTaught!.filter((c) => c === q.classId) : actor.classIdsTaught! };
      if (q.status) where.status = q.status as Prisma.MissionWhereInput['status'];
      else where.status = { not: 'ARCHIVED' };
    } else {
      where.class = { schoolId: actor.schoolId };
      if (q.classId) where.classId = q.classId;
      if (q.status) where.status = q.status as Prisma.MissionWhereInput['status'];
    }
    const missions = await this.prisma.mission.findMany({
      where,
      include: {
        topic: { include: { subject: true } },
        submissions: actor.role === 'STUDENT' ? { where: { studentId: a.userId }, orderBy: { startedAt: 'desc' }, take: 1 } : false,
        _count: { select: { submissions: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    return missions.map((m) => this.serialize(m));
  }

  serialize(m: Mission & { topic?: { key: string; name: unknown; subject?: { key: string; name: unknown; color: string; icon: string } }; submissions?: { id: string; status: string; attempt: number }[]; _count?: { submissions: number } }) {
    return {
      id: m.id,
      key: m.key,
      topicId: m.topicId,
      classId: m.classId,
      status: m.status,
      audience: m.audience,
      difficulty: m.difficulty,
      title: m.title,
      story: m.story,
      steps: m.steps,
      miniLesson: m.miniLesson,
      proofSpec: m.proofSpec,
      rubric: m.rubric,
      safetyNotes: m.safetyNotes,
      safetyCheck: m.safetyCheck,
      xpReward: m.xpReward,
      estimatedMin: m.estimatedMin,
      dueAt: m.dueAt,
      classroomCourseWorkId: m.classroomCourseWorkId,
      aiGenerated: m.aiGenerated,
      createdAt: m.createdAt,
      topic: m.topic ? { key: m.topic.key, name: m.topic.name, subject: m.topic.subject ? { key: m.topic.subject.key, name: m.topic.subject.name, color: m.topic.subject.color, icon: m.topic.subject.icon } : undefined } : undefined,
      mySubmission: m.submissions?.[0] ? { id: m.submissions[0].id, status: m.submissions[0].status, attempt: m.submissions[0].attempt } : null,
      submissionCount: m._count?.submissions,
    };
  }

  async get(a: AuthContext, id: string) {
    const m = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        topic: { include: { subject: true } },
        submissions: { where: { studentId: a.userId }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });
    if (!m) throw new NotFoundException('Mission not found');
    await this.assertRead(a, m);
    return this.serialize(m);
  }

  async update(
    a: AuthContext,
    id: string,
    body: { title?: I18nText; story?: I18nText; steps?: string[]; safetyNotes?: I18nText; difficulty?: Difficulty; estimatedMin?: number; audience?: MissionAudience },
  ) {
    const m = await this.getRaw(id);
    await this.assertWrite(a, m);
    if (m.status !== 'DRAFT') throw new ConflictException({ message: 'Only drafts can be edited. Archive and create a new mission instead.' });
    const data: Prisma.MissionUpdateInput = { safetyCheck: Prisma.DbNull };
    if (body.title) data.title = body.title;
    if (body.story) data.story = body.story;
    if (body.steps) data.steps = { en: body.steps };
    if (body.safetyNotes) data.safetyNotes = body.safetyNotes;
    if (body.difficulty) {
      data.difficulty = body.difficulty;
      data.xpReward = BASE_XP[body.difficulty];
    }
    if (body.estimatedMin) data.estimatedMin = body.estimatedMin;
    if (body.audience) data.audience = body.audience;
    return this.serialize(await this.prisma.mission.update({ where: { id }, data }));
  }

  /** DRAFT → (safety check) → APPROVED. Nothing reaches students without teacher approval. */
  async approve(a: AuthContext, id: string, body: { postToClassroom: boolean; dueAt?: string | null; useSaferVersion?: boolean }) {
    let m = await this.getRaw(id);
    await this.assertWrite(a, m);
    if (m.status === 'APPROVED') return { mission: this.serialize(m), classroom: null };
    if (m.status !== 'DRAFT') throw new ConflictException({ message: 'This mission is archived.' });

    if (body.useSaferVersion) {
      const prev = m.safetyCheck as { saferVersion?: string } | null;
      if (!prev?.saferVersion) throw new BadRequestException('No safer version available. Run the safety check first.');
      const sentences = prev.saferVersion.split(/(?<=\.)\s+/).filter(Boolean);
      m = await this.prisma.mission.update({ where: { id }, data: { steps: { en: sentences }, safetyNotes: { en: prev.saferVersion } } });
    }
    const safety = await this.runSafety(id);
    if (!safety.safe) {
      throw new UnprocessableEntityException({ message: 'This mission did not pass the safety check.', safety });
    }
    const approved = await this.prisma.mission.update({
      where: { id },
      data: { status: 'APPROVED', dueAt: body.dueAt ? new Date(body.dueAt) : null },
    });
    let classroom: { posted: boolean; error?: string } | null = null;
    if (body.postToClassroom) {
      try {
        const cw = await this.classroom.publishMission(id, a.userId);
        classroom = cw ? { posted: true } : { posted: false, error: 'This class is not linked to Google Classroom.' };
      } catch (e) {
        this.logger.warn(`Classroom post failed: ${e instanceof Error ? e.message : e}`);
        classroom = { posted: false, error: 'Could not post to Google Classroom. The mission is live in Tajriba.' };
      }
    }
    if (approved.classId) {
      const students = await this.prisma.enrollment.findMany({ where: { classId: approved.classId, status: 'ACTIVE' } });
      await this.notifications.notifyMany(
        students.map((s) => s.studentId),
        'MISSION_PUBLISHED',
        { missionId: id, title: approved.title },
        `published:${id}`,
      );
    }
    return { mission: this.serialize(await this.getRaw(id)), classroom };
  }

  async archive(a: AuthContext, id: string) {
    const m = await this.getRaw(id);
    await this.assertWrite(a, m);
    return this.serialize(await this.prisma.mission.update({ where: { id }, data: { status: 'ARCHIVED' } }));
  }
}
