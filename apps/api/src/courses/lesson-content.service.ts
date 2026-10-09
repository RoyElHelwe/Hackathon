import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { I18nText, pickText } from '@tajriba/shared';
import { AiService, AiUnavailableError, MediaPart } from '../ai/ai.service';
import { summarizeVideo, SummarizeVideoInput } from '../ai/tasks';
import { ClassroomAuthError, LessonMaterial, TeacherCredentials } from '../classroom/classroom.provider';
import { loadTeacherCredentials } from '../classroom/credentials';
import { PrismaService } from '../prisma/prisma.service';
import { DRIVE_READER, DriveFileMeta, DriveReader, FileTooLargeError } from './drive-reader';
import { MEDIA_TOOLS, MediaTools } from './media-tools';

export const MAX_FILE_CHARS = 15_000;
export const MAX_LESSON_CHARS = 60_000;
/** notes of one video/recording (all its chunks) */
export const MAX_MEDIA_CHARS = 20_000;
/** videos/recordings the AI watches per lesson; the rest are title-only */
export const MAX_MEDIA_PER_LESSON = 3;
/** largest media sent inline in one AI request (raw bytes; base64 adds a third) */
export const INLINE_MAX_BYTES = 18 * 1024 * 1024;
/** target size of one chunk of a long study copy */
export const CHUNK_TARGET_BYTES = 17 * 1024 * 1024;
/** Drive videos larger than this are not downloaded */
export const MAX_DOWNLOAD_BYTES = 1.5 * 1024 * 1024 * 1024;
/** only the first 2 hours of a recording are processed */
export const MAX_MEDIA_SEC = 2 * 60 * 60;
const MIN_CHUNK_SEC = 120;
const MAX_CHUNK_SEC = 20 * 60;

/** YouTube URLs only work on Gemini via Google AI Studio. */
const YOUTUBE_ROUTING = { order: ['google-ai-studio'], allow_fallbacks: false };

/** Drive video types the model takes as-is (data URL mime); anything else is transcoded first. */
const INLINE_VIDEO: Record<string, string> = {
  'video/mp4': 'video/mp4',
  'video/mpeg': 'video/mpeg',
  'video/quicktime': 'video/mov',
  'video/mov': 'video/mov',
  'video/webm': 'video/webm',
};
const INLINE_AUDIO: Record<string, 'mp3' | 'wav' | 'aac' | 'ogg' | 'flac' | 'm4a' | 'aiff'> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
};

/** What happened to one attachment: 'full' = the AI watched/listened to the whole media, 'text' = document text read. */
export type ContentStatus = 'full' | 'text' | 'title' | 'failed';
export type ContentKind = 'youtube' | 'video' | 'audio' | 'document' | 'file' | 'link' | 'form';
/** machine-readable reasons (the web localizes them; `note` is the English fallback) */
export type ContentCode = 'private' | 'too_large' | 'audio_only' | 'first_2h' | 'media_limit' | 'unreadable' | 'unsupported' | 'media_failed' | 'ai_failed' | 'reconnect';

export interface ContentReportItem {
  title: string;
  type: ContentKind;
  status: ContentStatus;
  note?: string;
  codes?: ContentCode[];
}

const NOTES: Record<ContentCode, string> = {
  private: 'video is private or unavailable — make it Unlisted or Public',
  too_large: 'video is larger than 1.5 GB',
  audio_only: 'audio only',
  first_2h: 'first 2 hours read',
  media_limit: `only ${MAX_MEDIA_PER_LESSON} videos per lesson are watched`,
  unreadable: 'could not open the file (is it shared with you?)',
  unsupported: "this file type can't be read",
  media_failed: "couldn't process this recording",
  ai_failed: "the AI couldn't watch it right now — try again later",
  reconnect: 'Google access needs to be reconnected',
};

export interface LessonContent {
  text: string;
  /** a section owner's Google access needs to be reconnected (those sections are marked RECONNECT) */
  reconnect: boolean;
  /** titles of attachments that could not be read */
  unreadable: string[];
  /** per attachment: how much of it the AI could read */
  report: ContentReportItem[];
}

interface Ctx {
  lessonId: string;
  creds: { classId: string; creds: TeacherCredentials }[] | null;
  reconnect: boolean;
  subject: string;
  grade: number;
  locale: string;
}

interface MediaResult {
  summary: string | null;
  status: ContentStatus;
  codes: ContentCode[];
}

const clean = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n[…]` : s);
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export function youtubeId(m: LessonMaterial): string | null {
  if (m.id) return m.id;
  const match = m.url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{6,})/);
  return match ? match[1] : null;
}

/**
 * Collects a lesson's readable text for AI: title + description, then each attachment (Docs/Slides/Sheets exported,
 * PDFs text-extracted, YouTube and Drive videos/recordings watched by AI, links by title + URL, forms skipped).
 * One failing file never fails the lesson.
 */
@Injectable()
export class LessonContentService {
  private readonly logger = new Logger('LessonContent');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    @Inject(DRIVE_READER) private readonly drive: DriveReader,
    @Inject(MEDIA_TOOLS) private readonly tools: MediaTools,
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

  /** Tries the section owners in turn: the first one usually works; others help when a file isn't shared with them. */
  private async withOwners<T>(ctx: Ctx, fileId: string, fn: (c: TeacherCredentials) => Promise<T>): Promise<{ ok: true; value: T; creds: TeacherCredentials } | { ok: false }> {
    ctx.creds ??= await this.candidates(ctx.lessonId);
    for (const c of [...ctx.creds]) {
      try {
        return { ok: true, value: await fn(c.creds), creds: c.creds };
      } catch (e) {
        if (e instanceof ClassroomAuthError) {
          ctx.reconnect = true;
          ctx.creds = ctx.creds.filter((x) => x !== c);
          await this.prisma.class.update({ where: { id: c.classId }, data: { syncError: 'RECONNECT' } }).catch(() => undefined);
        } else {
          this.logger.warn(`Could not read Drive file ${fileId}: ${errText(e)}`);
        }
      }
    }
    return { ok: false };
  }

  /** `textOnly`: no video/recording download, transcoding or AI watching — media attachments are listed by title only. */
  async collect(lessonId: string, opts: { locale?: string; textOnly?: boolean } = {}): Promise<LessonContent> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: { include: { subject: true } } } });
    if (!lesson) throw new NotFoundException();
    const ctx: Ctx = {
      lessonId,
      creds: null,
      reconnect: false,
      subject: pickText(lesson.course.subject.name as I18nText, 'en'),
      grade: lesson.course.gradeLevel,
      locale: opts.locale || 'en',
    };
    const parts: string[] = [`# Lesson: ${lesson.title}`];
    if (lesson.description.trim()) parts.push(clean(lesson.description));
    const materials = (lesson.materials ?? []) as unknown as LessonMaterial[];
    const unreadable: string[] = [];
    const report: ContentReportItem[] = [];
    let mediaCount = 0;
    const add = (title: string, type: ContentKind, status: ContentStatus, codes: ContentCode[] = []) =>
      report.push({ title, type, status, ...(codes.length ? { codes, note: codes.map((c) => NOTES[c]).join('; ') } : {}) });
    /** section for a watched video/recording; title-only (with URL) when it couldn't be watched */
    const mediaSection = (m: LessonMaterial, kind: 'youtube' | 'video' | 'audio', r: MediaResult) => {
      add(m.title, kind, r.status, r.codes);
      if (!r.summary) {
        parts.push(`## ${kind === 'audio' ? 'Audio' : 'Video'}: ${m.title}\n${m.url}`);
        return;
      }
      const head =
        kind === 'audio'
          ? `## Audio: ${m.title} (AI listened to the full recording)`
          : r.codes.includes('audio_only')
            ? `## Video: ${m.title} (AI listened to the full video's audio)`
            : `## Video: ${m.title} (AI watched the full video)`;
      const extra = r.codes.includes('first_2h') ? '\n(only the first 2 hours were read)' : '';
      parts.push(`${head}${extra}\n${cap(clean(r.summary), MAX_MEDIA_CHARS)}`);
    };

    for (const m of materials) {
      if (m.type === 'form') {
        add(m.title, 'form', 'title');
        continue;
      }
      if (m.type === 'link') {
        parts.push(`## Link: ${m.title}\n${m.url}`);
        add(m.title, 'link', 'title');
        continue;
      }
      if (m.type === 'youtube') {
        if (opts.textOnly) {
          parts.push(`## Video: ${m.title}\n${m.url}`);
          add(m.title, 'youtube', 'title');
          continue;
        }
        if (mediaCount >= MAX_MEDIA_PER_LESSON) {
          parts.push(`## Video: ${m.title}\n${m.url}`);
          add(m.title, 'youtube', 'title', ['media_limit']);
          continue;
        }
        mediaCount++;
        mediaSection(m, 'youtube', await this.watchYoutube(ctx, m));
        continue;
      }
      if (!m.id) {
        parts.push(`## File: ${m.title}`);
        add(m.title, 'file', 'title');
        continue;
      }

      const mediaHint = /^(video|audio)\//.test(m.mimeType ?? '');
      if (opts.textOnly && mediaHint) {
        parts.push(`## ${m.mimeType?.startsWith('audio/') ? 'Audio' : 'Video'}: ${m.title}`);
        add(m.title, m.mimeType?.startsWith('audio/') ? 'audio' : 'video', 'title');
        continue;
      }
      let text: string | null = null;
      if (!mediaHint) {
        const r = await this.withOwners(ctx, m.id, (c) => this.drive.readText(c, m.id!));
        if (!r.ok) {
          unreadable.push(m.title);
          parts.push(`## File: ${m.title}\n(could not read: ${m.title})`);
          add(m.title, 'file', 'failed', [ctx.reconnect && !ctx.creds?.length ? 'reconnect' : 'unreadable']);
          continue;
        }
        text = r.value;
        if (text !== null) {
          if (clean(text)) {
            parts.push(`## File: ${m.title}\n${cap(clean(text), MAX_FILE_CHARS)}`);
            add(m.title, 'document', 'text');
          } else {
            parts.push(`## File: ${m.title}`);
            add(m.title, 'document', 'title');
          }
          continue;
        }
      }

      // Not text: maybe a video or a recording.
      if (opts.textOnly) {
        parts.push(`## File: ${m.title}`);
        add(m.title, 'file', 'title');
        continue;
      }
      const meta = await this.withOwners(ctx, m.id, (c) => this.drive.meta(c, m.id!));
      const mime = meta.ok ? meta.value.mimeType : '';
      const kind = mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : null;
      if (!meta.ok || !kind) {
        parts.push(`## File: ${m.title}`);
        if (!meta.ok && mediaHint) {
          unreadable.push(m.title);
          add(m.title, m.mimeType?.startsWith('audio/') ? 'audio' : 'video', 'failed', [ctx.reconnect && !ctx.creds?.length ? 'reconnect' : 'unreadable']);
        } else add(m.title, 'file', 'title', ['unsupported']);
        continue;
      }
      if (mediaCount >= MAX_MEDIA_PER_LESSON) {
        mediaSection(m, kind, { summary: null, status: 'title', codes: ['media_limit'] });
        continue;
      }
      mediaCount++;
      const r = await this.watchDrive(ctx, meta.creds, meta.value, m.title);
      if (r.status === 'failed') unreadable.push(m.title);
      mediaSection(m, kind, r);
    }
    return { text: cap(parts.join('\n\n'), MAX_LESSON_CHARS), reconnect: ctx.reconnect, unreadable, report };
  }

  private input(ctx: Ctx, title: string, kind: SummarizeVideoInput['kind'], identity: string, part?: SummarizeVideoInput['part']): SummarizeVideoInput {
    return { title, subject: ctx.subject, grade: ctx.grade, locale: ctx.locale, kind, identity, ...(part ? { part } : {}) };
  }

  private async watchYoutube(ctx: Ctx, m: LessonMaterial): Promise<MediaResult> {
    const id = youtubeId(m);
    if (!id) return { summary: null, status: 'failed', codes: ['private'] };
    if ((await this.tools.youtubeStatus(id)) === 'unavailable') return { summary: null, status: 'failed', codes: ['private'] };
    try {
      const out = await this.ai.run(summarizeVideo, this.input(ctx, m.title, 'youtube', `yt:${id}`), {
        media: [{ type: 'video_url', video_url: { url: `https://www.youtube.com/watch?v=${id}` } }],
        provider: YOUTUBE_ROUTING,
      });
      return { summary: out.summary, status: 'full', codes: [] };
    } catch (e) {
      this.logger.warn(`Could not watch YouTube ${id}: ${errText(e)}`);
      // Usually a private/age-restricted video or one too long for the model.
      return { summary: null, status: 'failed', codes: ['ai_failed'] };
    }
  }

  /**
   * A Drive video/recording: small files go whole; bigger ones are streamed to /tmp, shrunk to a 1 fps / 480p study copy
   * (or audio only when that fails) and summarized in time chunks. Temp files are always deleted.
   */
  private async watchDrive(ctx: Ctx, creds: TeacherCredentials, meta: DriveFileMeta, title: string): Promise<MediaResult> {
    const isVideo = meta.mimeType.startsWith('video/');
    if (meta.size > MAX_DOWNLOAD_BYTES) return { summary: null, status: 'failed', codes: ['too_large'] };
    const base = `drive:${meta.id}:${meta.md5Checksum || meta.modifiedTime || meta.size}`;
    let dir: string | null = null;
    try {
      dir = await mkdtemp(join(tmpdir(), 'tajriba-media-'));
      const src = join(dir, 'source');
      const downloaded = await this.drive.download(creds, meta.id, src, MAX_DOWNLOAD_BYTES);
      // Drive's size is authoritative for binary files
      const bytes = meta.size || downloaded;
      let durationSec = meta.durationMs ? meta.durationMs / 1000 : 0;

      const inlineVideo = isVideo ? INLINE_VIDEO[meta.mimeType] : undefined;
      const inlineAudio = isVideo ? undefined : INLINE_AUDIO[meta.mimeType];
      if (bytes <= INLINE_MAX_BYTES && (inlineVideo || inlineAudio) && durationSec <= MAX_MEDIA_SEC) {
        const data = (await readFile(src)).toString('base64');
        const part: MediaPart = inlineVideo
          ? { type: 'video_url', video_url: { url: `data:${inlineVideo};base64,${data}` } }
          : { type: 'input_audio', input_audio: { data, format: inlineAudio! } };
        const out = await this.ai.run(summarizeVideo, this.input(ctx, title, isVideo ? 'file' : 'audio', `${base}:whole`), { media: [part] });
        return { summary: out.summary, status: 'full', codes: [] };
      }

      if (!durationSec) durationSec = (await this.tools.probe(src)).durationSec;
      const codes: ContentCode[] = durationSec > MAX_MEDIA_SEC ? ['first_2h'] : [];
      if (isVideo) {
        const study = join(dir, 'study.mp4');
        let transcoded = false;
        try {
          await this.tools.transcodeStudy(src, study, MAX_MEDIA_SEC);
          transcoded = true;
        } catch (e) {
          this.logger.warn(`Transcoding Drive video ${meta.id} failed, trying audio only: ${errText(e)}`);
          await rm(study, { force: true });
        }
        if (transcoded) {
          await rm(src, { force: true });
          return { summary: await this.chunked(ctx, study, title, 'video', `${base}:study`), status: 'full', codes };
        }
        codes.push('audio_only');
      }
      const audio = join(dir, 'audio.mp3');
      await this.tools.extractAudio(src, audio, MAX_MEDIA_SEC);
      await rm(src, { force: true });
      return { summary: await this.chunked(ctx, audio, title, 'audio', `${base}:audio`), status: 'full', codes };
    } catch (e) {
      this.logger.warn(`Could not watch Drive media ${meta.id}: ${errText(e)}`);
      if (e instanceof FileTooLargeError) return { summary: null, status: 'failed', codes: ['too_large'] };
      if (e instanceof ClassroomAuthError) ctx.reconnect = true;
      return { summary: null, status: 'failed', codes: [e instanceof AiUnavailableError ? 'ai_failed' : 'media_failed'] };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Sends a (shrunk) media file whole when it fits, else in time chunks of ≤ ~17 MB; notes joined in order. */
  private async chunked(ctx: Ctx, file: string, title: string, kind: 'video' | 'audio', identity: string): Promise<string> {
    const send = async (f: string, part?: SummarizeVideoInput['part']) => {
      const data = (await readFile(f)).toString('base64');
      const media: MediaPart = kind === 'video' ? { type: 'video_url', video_url: { url: `data:video/mp4;base64,${data}` } } : { type: 'input_audio', input_audio: { data, format: 'mp3' } };
      const suffix = part ? `:${part.startSec}-${part.endSec}` : ':whole';
      return (await this.ai.run(summarizeVideo, this.input(ctx, title, kind === 'video' ? 'file' : 'audio', `${identity}${suffix}`, part), { media: [media] })).summary;
    };
    const { durationSec, bytes } = await this.tools.probe(file);
    if (bytes <= INLINE_MAX_BYTES) return send(file);
    if (!durationSec) throw new Error('unknown duration of the study copy');
    const perSec = bytes / durationSec;
    const len = Math.max(MIN_CHUNK_SEC, Math.min(MAX_CHUNK_SEC, Math.floor(CHUNK_TARGET_BYTES / perSec)));
    const total = Math.ceil(durationSec / len);
    const notes: string[] = [];
    for (let i = 0; i < total; i++) {
      const startSec = i * len;
      const endSec = Math.min(Math.ceil(durationSec), startSec + len);
      const chunk = `${file}.part${i}${kind === 'video' ? '.mp4' : '.mp3'}`;
      try {
        await this.tools.cut(file, chunk, startSec, endSec - startSec);
        const size = (await stat(chunk)).size;
        if (size > INLINE_MAX_BYTES * 1.1) throw new Error(`chunk ${i} is ${size} bytes`);
        const summary = await send(chunk, { index: i, total, startSec, endSec });
        notes.push(`[${mmss(startSec)}–${mmss(endSec)}]\n${clean(summary)}`);
      } finally {
        await rm(chunk, { force: true });
      }
    }
    return notes.join('\n\n');
  }
}
