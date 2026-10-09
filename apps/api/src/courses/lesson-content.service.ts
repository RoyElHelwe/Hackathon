import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClassroomAuthError, LessonMaterial, TeacherCredentials } from '../classroom/classroom.provider';
import { loadTeacherCredentials } from '../classroom/credentials';
import { PrismaService } from '../prisma/prisma.service';
import { DRIVE_READER, DriveReader } from './drive-reader';

export const MAX_FILE_CHARS = 15_000;
export const MAX_LESSON_CHARS = 40_000;

export interface LessonContent {
  text: string;
  /** a section owner's Google access needs to be reconnected (those sections are marked RECONNECT) */
  reconnect: boolean;
  /** titles of attachments that could not be read */
  unreadable: string[];
}

const clean = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n[…]` : s);

/**
 * Collects a lesson's readable text for AI: title + description, then each attachment (Docs/Slides/Sheets exported,
 * PDFs text-extracted, YouTube/links by title + URL, forms skipped). One failing file never fails the lesson.
 */
@Injectable()
export class LessonContentService {
  private readonly logger = new Logger('LessonContent');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DRIVE_READER) private readonly drive: DriveReader,
  ) {}

  /** Owners of the sections that posted the lesson (first source first), with the section to flag on auth errors. */
  private async candidates(lessonId: string): Promise<{ classId: string; creds: TeacherCredentials }[]> {
    const sources = await this.prisma.lessonSource.findMany({
      where: { lessonId },
      orderBy: { id: 'asc' },
      include: { class: { include: { teachers: true } } },
    });
    const out: { classId: string; creds: TeacherCredentials }[] = [];
    const seen = new Set<string>();
    for (const s of sources) {
      const owner = s.class.teachers.find((t) => t.type === 'OWNER') ?? s.class.teachers[0];
      if (!owner || seen.has(owner.teacherId)) continue;
      seen.add(owner.teacherId);
      out.push({ classId: s.classId, creds: await loadTeacherCredentials(this.prisma, owner.teacherId) });
    }
    return out;
  }

  async collect(lessonId: string): Promise<LessonContent> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException();
    const parts: string[] = [`# Lesson: ${lesson.title}`];
    if (lesson.description.trim()) parts.push(clean(lesson.description));
    const materials = (lesson.materials ?? []) as unknown as LessonMaterial[];
    const unreadable: string[] = [];
    let reconnect = false;
    let creds: { classId: string; creds: TeacherCredentials }[] | null = null;

    for (const m of materials) {
      if (m.type === 'form') continue;
      if (m.type === 'youtube') {
        parts.push(`## Video: ${m.title}\n${m.url}`);
        continue;
      }
      if (m.type === 'link') {
        parts.push(`## Link: ${m.title}\n${m.url}`);
        continue;
      }
      if (!m.id) {
        parts.push(`## File: ${m.title}`);
        continue;
      }
      creds ??= await this.candidates(lessonId);
      let text: string | null | undefined;
      let failed = false;
      // Try the section owners in turn: the first one usually works; others help when a file isn't shared with them.
      for (const c of [...creds]) {
        try {
          text = await this.drive.readText(c.creds, m.id);
          failed = false;
          break;
        } catch (e) {
          failed = true;
          if (e instanceof ClassroomAuthError) {
            reconnect = true;
            creds = creds.filter((x) => x !== c);
            await this.prisma.class.update({ where: { id: c.classId }, data: { syncError: 'RECONNECT' } }).catch(() => undefined);
          } else {
            this.logger.warn(`Could not read Drive file ${m.id}: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
      if (failed || text === undefined) {
        unreadable.push(m.title);
        parts.push(`## File: ${m.title}\n(could not read: ${m.title})`);
      } else if (text && clean(text)) {
        parts.push(`## File: ${m.title}\n${cap(clean(text), MAX_FILE_CHARS)}`);
      } else {
        parts.push(`## File: ${m.title}`);
      }
    }
    return { text: cap(parts.join('\n\n'), MAX_LESSON_CHARS), reconnect, unreadable };
  }
}
