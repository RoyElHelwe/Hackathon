import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Actor, can, SetClassCourseBody } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseMissionsService } from './course-missions.service';
import { LessonSyncService } from './lesson-sync.service';

const COURSE_INCLUDE = {
  subject: { select: { id: true, key: true, name: true, color: true, icon: true } },
  classes: {
    orderBy: [{ sectionLabel: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
  },
} satisfies Prisma.CourseInclude;
type CourseRow = Prisma.CourseGetPayload<{ include: typeof COURSE_INCLUDE }>;

const isAdmin = (a: Actor) => a.role === 'DIRECTOR' || a.role === 'ADMIN';

/** Section ids the actor can see (null = every section in the school). */
function visibleClassIds(a: Actor): string[] | null {
  if (isAdmin(a)) return null;
  if (a.role === 'TEACHER') return a.classIdsTaught ?? [];
  if (a.role === 'STUDENT') return a.classIdsEnrolled ?? [];
  if (a.role === 'PARENT') return a.childClassIds ?? [];
  return [];
}

@Injectable()
export class CoursesService {
  private readonly logger = new Logger('Courses');

  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
    private readonly lessonSync: LessonSyncService,
    private readonly courseMissions: CourseMissionsService,
  ) {}

  /** The course for (school, subject, grade), created on first use. The subject must belong to the school. */
  async findOrCreate(schoolId: string, subjectId: string, gradeLevel: number) {
    if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) throw new BadRequestException('Grade must be between 1 and 12.');
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || subject.schoolId !== schoolId) throw new BadRequestException('Unknown subject for this school.');
    return this.prisma.course.upsert({
      where: { schoolId_subjectId_gradeLevel: { schoolId, subjectId, gradeLevel } },
      update: {},
      create: { schoolId, subjectId, gradeLevel },
    });
  }

  /**
   * Puts a section in a course (keeping Class.subjectId/gradeLevel in sync). Moving away from another course
   * drops the section's posts from the old course's lessons (orphans get archived there).
   */
  async attach(classId: string, course: { id: string; subjectId: string; gradeLevel: number }, sectionLabel?: string | null) {
    const cls = await this.prisma.class.findUniqueOrThrow({ where: { id: classId } });
    const oldCourseId = cls.courseId;
    await this.prisma.class.update({
      where: { id: classId },
      data: {
        courseId: course.id,
        subjectId: course.subjectId,
        gradeLevel: course.gradeLevel,
        ...(sectionLabel !== undefined ? { sectionLabel: sectionLabel?.trim().toUpperCase() || null } : {}),
      },
    });
    if (oldCourseId && oldCourseId !== course.id) {
      await this.prisma.lessonSource.deleteMany({ where: { classId, lesson: { courseId: oldCourseId } } });
      await this.lessonSync.archiveOrphans(oldCourseId);
      await this.lessonSync.reorder(oldCourseId);
    }
    // A section joining a course gets the course's approved missions (already-published ones are not re-posted to Classroom).
    if (oldCourseId !== course.id) await this.courseMissions.copyApprovedTemplates(course.id, classId);
  }

  /** Lesson sync that never throws (used after imports / moves and by the cron). */
  async syncQuietly(courseId: string) {
    try {
      return await this.lessonSync.syncCourse(courseId);
    } catch (e) {
      this.logger.warn(`Lesson sync failed for course ${courseId}: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  private async shape(rows: CourseRow[], actor: Actor) {
    const visible = visibleClassIds(actor);
    const ids = rows.map((r) => r.id);
    const counts = await this.prisma.lesson.groupBy({ by: ['courseId', 'status'], where: { courseId: { in: ids }, archivedAt: null }, _count: true });
    return rows.map((c) => {
      const mine = c.classes.filter((s) => !visible || visible.includes(s.id));
      const lessonCounts = counts.filter((x) => x.courseId === c.id);
      return {
        id: c.id,
        gradeLevel: c.gradeLevel,
        subject: c.subject,
        sectionCount: c.classes.length,
        sections: mine.map((s) => ({
          id: s.id,
          name: s.name,
          sectionLabel: s.sectionLabel,
          studentCount: s._count.enrollments,
          syncError: s.syncError,
          lastSyncedAt: s.lastSyncedAt,
          classroomLinked: !!s.classroomCourseId,
        })),
        lessonCount: lessonCounts.reduce((n, x) => n + x._count, 0),
        gamifiedCount: lessonCounts.filter((x) => x.status === 'READY').reduce((n, x) => n + x._count, 0),
        canEdit: can(actor, 'write', 'course', { schoolId: c.schoolId, courseClassIds: c.classes.map((s) => s.id) }),
      };
    });
  }

  async mine(a: AuthContext) {
    const actor = await this.actors.actor(a);
    const visible = visibleClassIds(actor);
    const rows = await this.prisma.course.findMany({
      where: { schoolId: actor.schoolId, ...(visible ? { classes: { some: { id: { in: visible } } } } : {}) },
      include: COURSE_INCLUDE,
      orderBy: [{ gradeLevel: 'asc' }, { createdAt: 'asc' }],
    });
    return this.shape(rows, actor);
  }

  private async load(a: AuthContext, id: string, action: 'read' | 'write') {
    const c = await this.prisma.course.findUnique({ where: { id }, include: COURSE_INCLUDE });
    if (!c) throw new NotFoundException();
    const actor = await this.actors.assert(a, action, 'course', { schoolId: c.schoolId, courseClassIds: c.classes.map((s) => s.id) });
    return { c, actor };
  }

  async get(a: AuthContext, id: string) {
    const { c, actor } = await this.load(a, id, 'read');
    return (await this.shape([c], actor))[0];
  }

  async lessons(a: AuthContext, id: string) {
    const { actor } = await this.load(a, id, 'read');
    const visible = visibleClassIds(actor);
    const rows = await this.prisma.lesson.findMany({
      where: { courseId: id, archivedAt: null },
      include: { sources: { select: { classId: true, classroomUrl: true } }, topic: { select: { id: true, name: true } } },
      orderBy: [{ position: 'asc' }, { postedAt: 'asc' }],
    });
    const topicIds = rows.flatMap((l) => (l.topic ? [l.topic.id] : []));
    const counts = topicIds.length
      ? await this.prisma.mission.groupBy({
          by: ['topicId', 'status'],
          where: { courseId: id, classId: null, topicId: { in: topicIds }, status: { in: ['DRAFT', 'APPROVED'] } },
          _count: true,
        })
      : [];
    const count = (topicId: string | undefined, status: 'DRAFT' | 'APPROVED') => counts.find((c) => c.topicId === topicId && c.status === status)?._count ?? 0;
    return rows.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      kind: l.kind,
      materials: l.materials,
      position: l.position,
      postedAt: l.postedAt,
      status: l.status,
      gamifyError: l.gamifyError,
      contentChangedAt: l.contentChangedAt,
      archived: false,
      topic: l.topic ? { id: l.topic.id, name: l.topic.name } : null,
      draftCount: count(l.topic?.id, 'DRAFT'),
      approvedCount: count(l.topic?.id, 'APPROVED'),
      // the actor's own sections first, so "Open in Classroom" opens a course they can access
      sources: [...l.sources].sort((x, y) => Number(!!visible && !visible.includes(x.classId)) - Number(!!visible && !visible.includes(y.classId))),
    }));
  }

  async sync(a: AuthContext, id: string) {
    await this.load(a, id, 'write');
    return this.lessonSync.syncCourse(id);
  }

  /** "Set subject & grade" for a section: a teacher of the section (or a director/admin) moves it to a course. */
  async setClassCourse(a: AuthContext, classId: string, body: SetClassCourseBody) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException();
    await this.actors.assert(a, 'write', 'class', { schoolId: cls.schoolId, classId });
    const course = await this.findOrCreate(cls.schoolId, body.subjectId, body.gradeLevel);
    await this.attach(classId, course, body.sectionLabel === undefined ? undefined : body.sectionLabel);
    if (cls.classroomCourseId) await this.syncQuietly(course.id);
    return { classId, courseId: course.id, subjectId: course.subjectId, gradeLevel: course.gradeLevel };
  }
}
