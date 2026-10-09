import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TOPIC_INCLUDE = {
  prerequisites: true,
  subject: { select: { id: true, key: true, name: true, color: true, icon: true } },
} satisfies Prisma.TopicInclude;
export type VisibleTopic = Prisma.TopicGetPayload<{ include: typeof TOPIC_INCLUDE }>;
export type VisibleSubject = VisibleTopic['subject'];

type ClassRef = { id: string; courseId: string | null; subjectId: string | null };

const byPosition = (x: VisibleTopic, y: VisibleTopic) => x.posY - y.posY || x.posX - y.posX;

/**
 * Which skills (Topics) each section shows — the single source of truth for maps, heatmaps and coverage.
 * A section sees its course's lesson skills plus the legacy (pre-course) topics of its subject that it actually
 * uses (has a mission on) and their prerequisites. No subject and no course → nothing (never a math fallback).
 */
@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  /** Visible topics per section id (one query batch for many sections). */
  async topicsByClass(classes: ClassRef[]): Promise<Map<string, VisibleTopic[]>> {
    const out = new Map<string, VisibleTopic[]>(classes.map((c) => [c.id, []]));
    if (!classes.length) return out;
    const courseIds = [...new Set(classes.flatMap((c) => (c.courseId ? [c.courseId] : [])))];
    const subjectIds = [...new Set(classes.flatMap((c) => (c.subjectId ? [c.subjectId] : [])))];
    const [courseTopics, legacyTopics, used] = await Promise.all([
      courseIds.length ? this.prisma.topic.findMany({ where: { courseId: { in: courseIds } }, include: TOPIC_INCLUDE }) : [],
      subjectIds.length ? this.prisma.topic.findMany({ where: { courseId: null, subjectId: { in: subjectIds } }, include: TOPIC_INCLUDE }) : [],
      subjectIds.length
        ? this.prisma.mission.findMany({
            where: { classId: { in: classes.map((c) => c.id) }, topic: { courseId: null } },
            select: { classId: true, topicId: true },
            distinct: ['classId', 'topicId'],
          })
        : [],
    ]);
    const legacyById = new Map(legacyTopics.map((t) => [t.id, t]));
    for (const c of classes) {
      const own = c.courseId ? courseTopics.filter((t) => t.courseId === c.courseId) : [];
      const legacy: VisibleTopic[] = [];
      if (c.subjectId) {
        // used legacy topics of the section's subject + their prerequisite closure (keeps the map connected)
        const keep = new Set<string>();
        const stack = used.filter((u) => u.classId === c.id).map((u) => u.topicId);
        while (stack.length) {
          const id = stack.pop()!;
          const t = legacyById.get(id);
          if (!t || t.subjectId !== c.subjectId || keep.has(id)) continue;
          keep.add(id);
          stack.push(...t.prerequisites.map((p) => p.prerequisiteId));
        }
        legacy.push(...legacyTopics.filter((t) => keep.has(t.id)));
      }
      out.set(c.id, [...legacy.sort(byPosition), ...own.sort(byPosition)]);
    }
    return out;
  }

  async classTopics(classId: string): Promise<VisibleTopic[]> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true, courseId: true, subjectId: true } });
    if (!cls) return [];
    return (await this.topicsByClass([cls])).get(classId) ?? [];
  }

  async classTopicIds(classId: string): Promise<string[]> {
    return (await this.classTopics(classId)).map((t) => t.id);
  }

  /** Union of the visible topics of several sections (deduplicated, grouped by subject name then position). */
  async topicsForClasses(classIds: string[]): Promise<VisibleTopic[]> {
    if (!classIds.length) return [];
    const classes = await this.prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, courseId: true, subjectId: true } });
    const seen = new Map<string, VisibleTopic>();
    for (const list of (await this.topicsByClass(classes)).values()) for (const t of list) if (!seen.has(t.id)) seen.set(t.id, t);
    return [...seen.values()];
  }

  async activeClassIds(studentId: string): Promise<string[]> {
    const rows = await this.prisma.enrollment.findMany({ where: { studentId, status: 'ACTIVE' }, select: { classId: true } });
    return rows.map((r) => r.classId);
  }

  /** Every skill a student can see: union over their ACTIVE sections. */
  async studentTopics(studentId: string): Promise<VisibleTopic[]> {
    return this.topicsForClasses(await this.activeClassIds(studentId));
  }

  /** Subjects of the given sections (their own subject, even without skills yet) and of their visible topics. */
  async subjectsForClasses(classIds: string[]): Promise<{ subject: VisibleSubject; topicCount: number }[]> {
    const topics = await this.topicsForClasses(classIds);
    const classes = classIds.length
      ? await this.prisma.class.findMany({
          where: { id: { in: classIds }, subjectId: { not: null } },
          select: { subject: { select: { id: true, key: true, name: true, color: true, icon: true } } },
        })
      : [];
    const map = new Map<string, { subject: VisibleSubject; topicCount: number }>();
    for (const c of classes) if (c.subject && !map.has(c.subject.id)) map.set(c.subject.id, { subject: c.subject, topicCount: 0 });
    for (const t of topics) {
      const row = map.get(t.subjectId) ?? { subject: t.subject, topicCount: 0 };
      row.topicCount++;
      map.set(t.subjectId, row);
    }
    return [...map.values()];
  }

  async studentSubjects(studentId: string) {
    return this.subjectsForClasses(await this.activeClassIds(studentId));
  }

  /** The school's courses with their sections (director coverage). */
  async schoolCourses(schoolId: string) {
    return this.prisma.course.findMany({
      where: { schoolId },
      include: {
        subject: { select: { id: true, key: true, name: true, color: true, icon: true } },
        classes: { select: { id: true, name: true, sectionLabel: true, courseId: true, subjectId: true }, orderBy: [{ sectionLabel: 'asc' }, { name: 'asc' }] },
      },
      orderBy: [{ gradeLevel: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
