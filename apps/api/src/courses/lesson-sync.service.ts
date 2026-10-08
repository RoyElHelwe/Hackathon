import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { config } from '../config';
import { sha256 } from '../common/crypto';
import { ClassroomAuthError, CLASSROOM_PROVIDER, ClassroomLessonItem, ClassroomProvider, LessonMaterial } from '../classroom/classroom.provider';
import { loadTeacherCredentials } from '../classroom/credentials';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LessonSyncResult {
  /** non-archived lessons after the sync */
  lessons: number;
  added: number;
  archived: number;
  /** at least one section needs the teacher to reconnect Google Classroom */
  reconnect: boolean;
  /** sections that could not be read (auth or other errors) */
  failedSections: number;
}

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function materialKey(m: LessonMaterial): string {
  if ((m.type === 'drive' || m.type === 'youtube') && m.id) return `${m.type}:${m.id}`;
  return `${m.type}:${m.url}`;
}

/** Same post copied to several sections → same fingerprint (title + attachments, order-independent). */
export function lessonFingerprint(item: Pick<ClassroomLessonItem, 'title' | 'materials'>): string {
  const keys = item.materials.map(materialKey).sort();
  return sha256(`${normalizeTitle(item.title)}|${keys.join(',')}`);
}

interface Seen {
  classId: string;
  item: ClassroomLessonItem;
  postedAt: Date;
}

/**
 * Pulls published Classroom Materials + Assignments of every section of a course and merges them into course lessons.
 * Errors are isolated per section; an auth/scope error marks that section RECONNECT.
 */
@Injectable()
export class LessonSyncService {
  private readonly logger = new Logger('LessonSync');
  private readonly running = new Map<string, Promise<LessonSyncResult>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLASSROOM_PROVIDER) private readonly provider: ClassroomProvider,
  ) {}

  /** Concurrent calls for the same course (cron + button) share one run. */
  syncCourse(courseId: string): Promise<LessonSyncResult> {
    const current = this.running.get(courseId);
    if (current) return current;
    const run = this.doSync(courseId).finally(() => this.running.delete(courseId));
    this.running.set(courseId, run);
    return run;
  }

  private isTajribaItem(item: ClassroomLessonItem, missionCourseWorkIds: Set<string>): boolean {
    if (missionCourseWorkIds.has(item.id)) return true;
    const web = config.WEB_URL.replace(/\/+$/, '');
    return !!web && item.materials.some((m) => m.url.startsWith(web));
  }

  private async doSync(courseId: string): Promise<LessonSyncResult> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { classes: { where: { classroomCourseId: { not: null } }, include: { teachers: true } } },
    });
    if (!course) throw new NotFoundException();
    const sectionIds = course.classes.map((c) => c.id);
    const missionIds = new Set(
      (
        await this.prisma.mission.findMany({
          where: { classId: { in: sectionIds }, classroomCourseWorkId: { not: null } },
          select: { classroomCourseWorkId: true },
        })
      ).map((m) => m.classroomCourseWorkId!),
    );

    let reconnect = false;
    let failedSections = 0;
    const okSections: string[] = [];
    const seen: Seen[] = [];
    for (const cls of course.classes) {
      const owner = cls.teachers.find((t) => t.type === 'OWNER') ?? cls.teachers[0];
      if (!owner) {
        failedSections++;
        continue;
      }
      try {
        const creds = await loadTeacherCredentials(this.prisma, owner.teacherId);
        const items = await this.provider.listLessons(creds, cls.classroomCourseId!);
        for (const item of items) {
          if (this.isTajribaItem(item, missionIds)) continue;
          const t = new Date(item.creationTime);
          seen.push({ classId: cls.id, item, postedAt: Number.isNaN(t.getTime()) ? new Date() : t });
        }
        okSections.push(cls.id);
      } catch (e) {
        failedSections++;
        if (e instanceof ClassroomAuthError) {
          reconnect = true;
          await this.prisma.class.update({ where: { id: cls.id }, data: { syncError: 'RECONNECT' } });
        } else {
          this.logger.warn(`Lesson sync failed for section ${cls.id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    // Group section posts into lessons.
    const groups = new Map<string, Seen[]>();
    for (const s of seen) {
      const fp = lessonFingerprint(s.item);
      groups.set(fp, [...(groups.get(fp) ?? []), s]);
    }

    let added = 0;
    const allSynced = failedSections === 0;
    for (const [fingerprint, posts] of groups) {
      posts.sort((a, b) => a.postedAt.getTime() - b.postedAt.getTime());
      const first = posts[0];
      const materials = first.item.materials as unknown as Prisma.InputJsonValue;
      const existing = await this.prisma.lesson.findUnique({ where: { courseId_fingerprint: { courseId, fingerprint } } });
      let lessonId: string;
      if (!existing) {
        const created = await this.prisma.lesson.upsert({
          where: { courseId_fingerprint: { courseId, fingerprint } },
          update: {},
          create: {
            courseId,
            fingerprint,
            kind: first.item.kind,
            title: first.item.title,
            description: first.item.description ?? '',
            materials,
            postedAt: first.postedAt,
          },
        });
        lessonId = created.id;
        added++;
      } else {
        const changed =
          existing.title !== first.item.title ||
          existing.description !== (first.item.description ?? '') ||
          JSON.stringify(existing.materials) !== JSON.stringify(first.item.materials);
        // A section that failed this run may still hold an earlier post of this lesson.
        const postedAt = allSynced || existing.postedAt > first.postedAt ? first.postedAt : existing.postedAt;
        await this.prisma.lesson.update({
          where: { id: existing.id },
          data: {
            kind: first.item.kind,
            title: first.item.title,
            description: first.item.description ?? '',
            materials,
            postedAt,
            archivedAt: null,
            ...(changed && existing.status === 'READY' ? { contentChangedAt: new Date() } : {}),
          },
        });
        lessonId = existing.id;
      }
      for (const p of posts) {
        await this.prisma.lessonSource.upsert({
          where: { classId_classroomItemId: { classId: p.classId, classroomItemId: p.item.id } },
          update: { lessonId, classroomUrl: p.item.alternateLink },
          create: { lessonId, classId: p.classId, classroomItemId: p.item.id, classroomUrl: p.item.alternateLink },
        });
      }
    }

    // Posts removed from Classroom (only for sections we could read).
    for (const classId of okSections) {
      const ids = seen.filter((s) => s.classId === classId).map((s) => s.item.id);
      await this.prisma.lessonSource.deleteMany({ where: { classId, classroomItemId: { notIn: ids } } });
    }
    const archived = await this.archiveOrphans(courseId);
    const lessons = await this.reorder(courseId);
    return { lessons, added, archived, reconnect, failedSections };
  }

  /** Lessons with no remaining section post are archived (never deleted). */
  async archiveOrphans(courseId: string): Promise<number> {
    const r = await this.prisma.lesson.updateMany({
      where: { courseId, archivedAt: null, sources: { none: {} } },
      data: { archivedAt: new Date() },
    });
    return r.count;
  }

  /** position = order of first post in Classroom. Returns the number of active lessons. */
  async reorder(courseId: string): Promise<number> {
    const active = await this.prisma.lesson.findMany({
      where: { courseId, archivedAt: null },
      orderBy: [{ postedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, position: true },
    });
    for (let i = 0; i < active.length; i++) {
      if (active[i].position !== i) await this.prisma.lesson.update({ where: { id: active[i].id }, data: { position: i } });
    }
    return active.length;
  }
}
