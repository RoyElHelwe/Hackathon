import { BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ImportClassesBody, pickText } from '@tajriba/shared';
import { AiService } from '../ai/ai.service';
import { heuristicParseCourses, parseCourses, ParseCoursesOutput } from '../ai/tasks';
import { config } from '../config';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { encrypt } from '../common/crypto';
import { CoursesService } from '../courses/courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { loadTeacherCredentials } from './credentials';
import { ClassroomAuthError, ClassroomCourse, CLASSROOM_PROVIDER, ClassroomPerson, ClassroomProvider, TeacherCredentials } from './classroom.provider';

interface Suggestion {
  subjectId: string | null;
  gradeLevel: number | null;
  sectionLabel: string | null;
  /** existing Course with the same subject + grade */
  courseId: string | null;
}

export interface SyncResult {
  classId: string;
  courseId?: string | null;
  name: string;
  added: number;
  archived: number;
  total: number;
  reconnect?: boolean;
}

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger('Classroom');

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly ai: AiService,
    private readonly courses: CoursesService,
    @Inject(CLASSROOM_PROVIDER) private readonly provider: ClassroomProvider,
  ) {}

  get kind() {
    return this.provider.kind;
  }

  credentials(userId: string): Promise<TeacherCredentials> {
    return loadTeacherCredentials(this.prisma, userId);
  }

  /** Fake mode: connecting is instant. */
  async connectFake(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { googleRefreshToken: encrypt('fake-refresh-token') } });
    await this.prisma.class.updateMany({ where: { teachers: { some: { teacherId: userId } } }, data: { syncError: null } });
  }

  private async markReconnect(userId: string) {
    await this.prisma.class.updateMany({ where: { teachers: { some: { teacherId: userId } } }, data: { syncError: 'RECONNECT' } });
  }

  /** Loads the school's subjects + courses and asks AI (one batched call) to classify each Classroom course. */
  private async suggest(schoolId: string, courses: ClassroomCourse[]) {
    const subjects = await this.prisma.subject.findMany({ where: { schoolId }, select: { id: true, key: true, name: true, color: true, icon: true } });
    const schoolCourses = await this.prisma.course.findMany({ where: { schoolId }, select: { id: true, subjectId: true, gradeLevel: true } });
    const existing = await this.prisma.class.findMany({
      where: { classroomCourseId: { in: courses.map((c) => c.id) } },
      include: { teachers: true, course: true },
    });
    let parsed: ParseCoursesOutput = { items: [] };
    const toParse = courses.filter((c) => !existing.some((e) => e.classroomCourseId === c.id && e.course));
    if (toParse.length && subjects.length) {
      const input = {
        // course names/sections only — never rosters
        courses: toParse.map((c) => ({ id: c.id, name: c.name, section: c.section ?? '' })),
        subjects: subjects.map((s) => {
          const n = s.name as { en?: string; ar?: string };
          return { id: s.id, name: [n.en, n.ar].filter(Boolean).join(' | ') };
        }),
      };
      try {
        parsed = await this.ai.run(parseCourses, input);
      } catch (e) {
        this.logger.warn(`parseCourses failed, using heuristic: ${e instanceof Error ? e.message : e}`);
        parsed = heuristicParseCourses(input);
      }
    }
    const subjectIds = new Set(subjects.map((s) => s.id));
    const suggestions = new Map<string, Suggestion>();
    for (const c of courses) {
      const cls = existing.find((e) => e.classroomCourseId === c.id);
      if (cls?.course) {
        suggestions.set(c.id, { subjectId: cls.course.subjectId, gradeLevel: cls.course.gradeLevel, sectionLabel: cls.sectionLabel, courseId: cls.course.id });
        continue;
      }
      const item = parsed.items.find((i) => i.id === c.id);
      const sure = !!item && item.confidence >= 0.5;
      const subjectId = sure && item.subjectId && subjectIds.has(item.subjectId) ? item.subjectId : null;
      const aiGrade = sure && item.gradeLevel && item.gradeLevel >= 1 && item.gradeLevel <= 12 ? item.gradeLevel : null;
      const providerGrade = c.gradeLevel && c.gradeLevel >= 1 && c.gradeLevel <= 12 ? c.gradeLevel : null;
      const gradeLevel = aiGrade ?? providerGrade;
      const sectionLabel = item?.sectionLabel ? item.sectionLabel.trim().toUpperCase().slice(0, 20) || null : null;
      const courseId = schoolCourses.find((sc) => sc.subjectId === subjectId && sc.gradeLevel === gradeLevel)?.id ?? null;
      suggestions.set(c.id, { subjectId, gradeLevel, sectionLabel, courseId });
    }
    return { subjects, schoolCourses, existing, suggestions };
  }

  async listCourses(a: AuthContext) {
    const actor = await this.actors.actor(a);
    const creds = await this.credentials(a.userId);
    const empty = { courses: [], subjects: [], schoolCourses: [] };
    if (this.provider.kind === 'google' && !creds.refreshToken) return { connected: false, ...empty };
    let courses: ClassroomCourse[];
    try {
      courses = await this.provider.listCourses(creds);
    } catch (e) {
      if (e instanceof ClassroomAuthError) {
        await this.markReconnect(a.userId);
        return { connected: false, reconnect: true, ...empty };
      }
      throw e;
    }
    const { subjects, schoolCourses, existing, suggestions } = await this.suggest(actor.schoolId, courses);
    return {
      connected: true,
      courses: courses.map((c) => {
        const cls = existing.find((e) => e.classroomCourseId === c.id);
        return {
          ...c,
          imported: !!cls?.teachers.some((t) => t.teacherId === a.userId),
          classId: cls?.id ?? null,
          suggestion: suggestions.get(c.id)!,
        };
      }),
      subjects,
      schoolCourses,
    };
  }

  /**
   * Imports courses. Golden rule: one Class per Classroom course. A second teacher importing
   * the same course becomes CO_TEACHER instead of duplicating it. Each section joins the Course
   * for its (subject, grade) — `items` carry the teacher's choice; legacy `courseIds` use the AI suggestions.
   */
  async import(a: AuthContext, body: ImportClassesBody): Promise<SyncResult[]> {
    const actor = await this.actors.actor(a);
    if (actor.role !== 'TEACHER') throw new ForbiddenException('Only teachers import classes.');
    const creds = await this.credentials(a.userId);
    let courses: ClassroomCourse[];
    try {
      courses = await this.provider.listCourses(creds);
    } catch (e) {
      if (e instanceof ClassroomAuthError) {
        await this.markReconnect(a.userId);
        throw new BadRequestException({ message: 'Reconnect Google Classroom', reconnect: true });
      }
      throw e;
    }

    type Entry = { courseId: string; explicit: boolean; subjectId: string | null; gradeLevel: number | null; sectionLabel?: string | null };
    const entries: Entry[] = (body.items ?? []).map((i) => ({ ...i, explicit: true }));
    const legacy = [...new Set(body.courseIds ?? [])].filter((id) => !entries.some((e) => e.courseId === id));
    if (legacy.length) {
      const { suggestions } = await this.suggest(actor.schoolId, courses.filter((c) => legacy.includes(c.id)));
      for (const id of legacy) {
        const s = suggestions.get(id);
        const ok = !!s?.subjectId && !!s.gradeLevel;
        entries.push({ courseId: id, explicit: false, subjectId: ok ? s!.subjectId : null, gradeLevel: ok ? s!.gradeLevel : null, sectionLabel: s?.sectionLabel ?? null });
      }
    }
    if (new Set(entries.map((e) => e.courseId)).size !== entries.length) throw new BadRequestException('Each course can only be imported once.');
    for (const e of entries) {
      if (!courses.some((c) => c.id === e.courseId)) throw new BadRequestException(`Course ${e.courseId} is not one of your Classroom courses.`);
    }
    const schoolSubjects = new Set((await this.prisma.subject.findMany({ where: { schoolId: actor.schoolId }, select: { id: true } })).map((s) => s.id));
    for (const e of entries) {
      if (e.subjectId && !schoolSubjects.has(e.subjectId)) throw new BadRequestException('Unknown subject for this school.');
    }

    const results: SyncResult[] = [];
    const touched = new Set<string>();
    for (const entry of entries) {
      const course = courses.find((c) => c.id === entry.courseId)!;
      let cls = await this.prisma.class.findUnique({ where: { classroomCourseId: entry.courseId } });
      if (cls) {
        if (cls.schoolId !== actor.schoolId) throw new ForbiddenException('This course belongs to another school.');
        const link = await this.prisma.classTeacher.findUnique({ where: { classId_teacherId: { classId: cls.id, teacherId: a.userId } } });
        if (!link) await this.prisma.classTeacher.create({ data: { classId: cls.id, teacherId: a.userId, type: 'CO_TEACHER' } });
      } else {
        cls = await this.prisma.class.create({
          data: {
            schoolId: actor.schoolId,
            name: course.name,
            gradeLevel: entry.gradeLevel ?? course.gradeLevel ?? null,
            classroomCourseId: entry.courseId,
            teachers: { create: { teacherId: a.userId, type: 'OWNER' } },
          },
        });
      }
      // Explicit choices move the section; suggestions only fill sections that have no course yet.
      let courseId = cls.courseId;
      if (entry.subjectId && entry.gradeLevel && (entry.explicit || !cls.courseId)) {
        const target = await this.courses.findOrCreate(actor.schoolId, entry.subjectId, entry.gradeLevel);
        await this.courses.attach(cls.id, target, entry.sectionLabel ?? cls.sectionLabel ?? null);
        courseId = target.id;
      }
      if (courseId) touched.add(courseId);
      results.push({ ...(await this.syncClass(cls.id, creds)), courseId });
    }
    a.actor = undefined;
    for (const id of touched) await this.courses.syncQuietly(id);
    return results;
  }

  private async upsertStudent(p: ClassroomPerson, schoolId: string) {
    const email = p.email?.toLowerCase() || `${p.userId}@classroom.invalid`;
    let user = await this.prisma.user.findUnique({ where: { googleId: p.userId } });
    if (!user && p.email) {
      // Fallback match by email (e.g. user pre-created with a different id source)
      user = await this.prisma.user.findUnique({ where: { email } });
    }
    if (!user) {
      user = await this.prisma.user.create({ data: { googleId: p.userId, email, name: p.name, avatarUrl: p.photoUrl ?? null, status: 'INVITED' } });
    }
    await this.prisma.membership.upsert({
      where: { userId_schoolId_role: { userId: user.id, schoolId, role: 'STUDENT' } },
      update: { status: 'APPROVED' },
      create: { userId: user.id, schoolId, role: 'STUDENT', status: 'APPROVED' },
    });
    await this.prisma.wallet.upsert({ where: { studentId: user.id }, update: {}, create: { studentId: user.id } });
    return user;
  }

  /** Roster sync: add new students, archive removed ones (never delete), pick up co-teachers. */
  async syncClass(classId: string, creds?: TeacherCredentials): Promise<SyncResult> {
    const cls = await this.prisma.class.findUniqueOrThrow({ where: { id: classId }, include: { teachers: true, enrollments: true } });
    if (!cls.classroomCourseId) return { classId, name: cls.name, added: 0, archived: 0, total: cls.enrollments.length };
    const owner = creds ?? (await this.credentials((cls.teachers.find((t) => t.type === 'OWNER') ?? cls.teachers[0]).teacherId));
    let students: ClassroomPerson[];
    let teachers: ClassroomPerson[];
    try {
      students = await this.provider.listStudents(owner, cls.classroomCourseId);
      teachers = await this.provider.listTeachers(owner, cls.classroomCourseId);
    } catch (e) {
      if (e instanceof ClassroomAuthError) {
        await this.prisma.class.update({ where: { id: classId }, data: { syncError: 'RECONNECT' } });
        return { classId, name: cls.name, added: 0, archived: 0, total: cls.enrollments.length, reconnect: true };
      }
      throw e;
    }

    let added = 0;
    const rosterUserIds: string[] = [];
    for (const p of students) {
      const user = await this.upsertStudent(p, cls.schoolId);
      rosterUserIds.push(user.id);
      const enr = cls.enrollments.find((e) => e.studentId === user.id);
      if (!enr || enr.status !== 'ACTIVE') {
        await this.prisma.enrollment.upsert({
          where: { classId_studentId: { classId, studentId: user.id } },
          update: { status: 'ACTIVE' },
          create: { classId, studentId: user.id, status: 'ACTIVE' },
        });
        added++;
      }
    }
    const toArchive = cls.enrollments.filter((e) => e.status === 'ACTIVE' && !rosterUserIds.includes(e.studentId));
    if (toArchive.length) {
      await this.prisma.enrollment.updateMany({
        where: { classId, studentId: { in: toArchive.map((e) => e.studentId) } },
        data: { status: 'ARCHIVED' },
      });
    }
    for (const t of teachers) {
      const user = await this.prisma.user.findUnique({ where: { googleId: t.userId } });
      if (!user) continue;
      const m = await this.prisma.membership.findUnique({ where: { userId_schoolId_role: { userId: user.id, schoolId: cls.schoolId, role: 'TEACHER' } } });
      if (m?.status !== 'APPROVED') continue;
      if (!cls.teachers.some((x) => x.teacherId === user.id)) {
        await this.prisma.classTeacher.create({ data: { classId, teacherId: user.id, type: 'CO_TEACHER' } });
      }
    }
    await this.prisma.class.update({ where: { id: classId }, data: { lastSyncedAt: new Date(), syncError: null } });
    await this.retryPendingGrades(classId);
    return { classId, name: cls.name, added, archived: toArchive.length, total: rosterUserIds.length };
  }

  async syncAll() {
    const classes = await this.prisma.class.findMany({ where: { classroomCourseId: { not: null } } });
    const results: SyncResult[] = [];
    for (const c of classes) {
      try {
        results.push(await this.syncClass(c.id));
      } catch (e) {
        this.logger.warn(`Sync failed for class ${c.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return results;
  }

  // ---------- Coursework & grades ----------

  async publishMission(missionId: string, teacherId: string): Promise<string | null> {
    const mission = await this.prisma.mission.findUniqueOrThrow({ where: { id: missionId }, include: { class: true } });
    if (!mission.class?.classroomCourseId) return null;
    const creds = await this.credentials(teacherId);
    const title = pickText(mission.title as never, 'en');
    const story = pickText(mission.story as never, 'en');
    const { id } = await this.provider.createCourseWork(creds, mission.class.classroomCourseId, {
      title: `Tajriba mission: ${title}`,
      description: `${story}\n\nOpen the mission in Tajriba to start. Your grade is sent back here when the mission is validated.`,
      dueAt: mission.dueAt,
      link: `${config.WEB_URL}/missions/${mission.id}`,
    });
    await this.prisma.mission.update({ where: { id: missionId }, data: { classroomCourseWorkId: id } });
    return id;
  }

  /** Grade passback. On failure the grade stays in Tajriba with gradeSynced=false and is retried on the next sync. */
  async pushGrade(submissionId: string): Promise<boolean> {
    const sub = await this.prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: { student: true, mission: { include: { class: { include: { teachers: true } } } } },
    });
    const m = sub.mission;
    if (!m.classroomCourseWorkId || !m.class?.classroomCourseId || sub.finalScore == null) return false;
    const teacher = m.class.teachers.find((t) => t.type === 'OWNER') ?? m.class.teachers[0];
    if (!teacher) return false;
    try {
      const creds = await this.credentials(teacher.teacherId);
      await this.provider.patchGrade(creds, m.class.classroomCourseId, m.classroomCourseWorkId, sub.student.googleId, sub.finalScore);
      await this.prisma.submission.update({ where: { id: sub.id }, data: { gradeSynced: true } });
      return true;
    } catch (e) {
      this.logger.warn(`Grade sync pending for submission ${sub.id}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof ClassroomAuthError) await this.prisma.class.update({ where: { id: m.class.id }, data: { syncError: 'RECONNECT' } });
      await this.prisma.submission.update({ where: { id: sub.id }, data: { gradeSynced: false } });
      return false;
    }
  }

  async retryPendingGrades(classId: string) {
    const pending = await this.prisma.submission.findMany({
      where: { status: 'VALIDATED', gradeSynced: false, mission: { classId, classroomCourseWorkId: { not: null } } },
      select: { id: true },
    });
    for (const p of pending) await this.pushGrade(p.id);
  }
}
