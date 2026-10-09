import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { google } from 'googleapis';
import { config } from '../config';
import { ClassroomAuthError, TeacherCredentials } from '../classroom/classroom.provider';
import { isInsufficientScope, isInvalidGrant } from '../classroom/google-classroom.provider';
import driveFixtures from '../classroom/fixtures/drive.json';

/** PDFs larger than this are not downloaded (title only). */
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

/** Reads the text of a lesson's Drive attachment. Separate from ClassroomProvider so tests never hit Google. */
export interface DriveReader {
  readonly kind: 'google' | 'fake';
  /**
   * Plain text of a Drive file, or null when the file type can't be read as text (images, videos, Office files…).
   * Throws ClassroomAuthError on revoked tokens / missing Drive scope; other errors mean "this file could not be read".
   */
  readText(t: TeacherCredentials, fileId: string): Promise<string | null>;
  /** File metadata (type, size, version, video duration). Same errors as readText. */
  meta(t: TeacherCredentials, fileId: string): Promise<DriveFileMeta>;
  /** Streams the file's bytes to `dest` (never buffered in memory). Throws when it exceeds maxBytes. Returns bytes written. */
  download(t: TeacherCredentials, fileId: string, dest: string, maxBytes: number): Promise<number>;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  /** bytes (0 when unknown, e.g. Google Docs) */
  size: number;
  md5Checksum?: string | null;
  modifiedTime?: string | null;
  /** videos only */
  durationMs?: number | null;
}

/** Media downloads may take a while (up to ~1.5 GB). */
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

export class FileTooLargeError extends Error {
  constructor() {
    super('File is larger than the download limit');
  }
}

/** Pass-through that aborts the stream once more than `max` bytes went through. */
function byteLimit(max: number, counter: { n: number }) {
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      counter.n += chunk.length;
      if (counter.n > max) cb(new FileTooLargeError());
      else cb(null, chunk);
    },
  });
}

export const DRIVE_READER = Symbol('DRIVE_READER');

const GOOGLE_EXPORT: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.presentation': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
};

const TEXT_MIME = /^text\/|^application\/(json|xml|csv)$/;

/** Real Drive v3 access with the teacher's offline refresh token (scope drive.readonly). */
export class GoogleDriveReader implements DriveReader {
  readonly kind = 'google' as const;

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isInvalidGrant(e)) throw new ClassroomAuthError();
      if (isInsufficientScope(e)) throw new ClassroomAuthError('Google Drive needs new permissions');
      throw e;
    }
  }

  private api(t: TeacherCredentials) {
    if (!t.refreshToken) throw new ClassroomAuthError('Google Classroom is not connected');
    const auth = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
    auth.setCredentials({ refresh_token: t.refreshToken });
    return google.drive({ version: 'v3', auth });
  }

  async meta(t: TeacherCredentials, fileId: string): Promise<DriveFileMeta> {
    const drive = this.api(t);
    const { data } = await this.call(() =>
      drive.files.get({ fileId, fields: 'id,name,mimeType,size,md5Checksum,modifiedTime,videoMediaMetadata(durationMillis)', supportsAllDrives: true }),
    );
    return {
      id: data.id ?? fileId,
      name: data.name ?? '',
      mimeType: data.mimeType ?? '',
      size: Number(data.size ?? 0),
      md5Checksum: data.md5Checksum ?? null,
      modifiedTime: data.modifiedTime ?? null,
      durationMs: data.videoMediaMetadata?.durationMillis ? Number(data.videoMediaMetadata.durationMillis) : null,
    };
  }

  async download(t: TeacherCredentials, fileId: string, dest: string, maxBytes: number): Promise<number> {
    const drive = this.api(t);
    const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
    const res = await this.call(() => drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream', signal }));
    const counter = { n: 0 };
    await pipeline(res.data as unknown as Readable, byteLimit(maxBytes, counter), createWriteStream(dest), { signal });
    return counter.n;
  }

  async readText(t: TeacherCredentials, fileId: string): Promise<string | null> {
    const drive = this.api(t);
    const meta = await this.call(() => drive.files.get({ fileId, fields: 'id,name,mimeType,size', supportsAllDrives: true }));
    const mime = meta.data.mimeType ?? '';
    const timeout = 30_000;

    const exportAs = GOOGLE_EXPORT[mime];
    if (exportAs) {
      const res = await this.call(() => drive.files.export({ fileId, mimeType: exportAs }, { responseType: 'text', timeout }));
      return typeof res.data === 'string' ? res.data : String(res.data ?? '');
    }
    if (mime === 'application/pdf') {
      const size = Number(meta.data.size ?? 0);
      if (!size || size > MAX_PDF_BYTES) return null;
      const res = await this.call(() => drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer', timeout }));
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(res.data as ArrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }
    if (TEXT_MIME.test(mime)) {
      const size = Number(meta.data.size ?? 0);
      if (size > MAX_PDF_BYTES) return null;
      const res = await this.call(() => drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'text', timeout }));
      return typeof res.data === 'string' ? res.data : String(res.data ?? '');
    }
    return null;
  }
}

/** Fixture-backed Drive (CLASSROOM_PROVIDER=fake): text per file id; unknown ids fail like an unshared file. */
export class FakeDriveReader implements DriveReader {
  readonly kind = 'fake' as const;
  files: Record<string, string> = { ...(driveFixtures as Record<string, string>) };
  /** fake video/audio files: metadata + the bytes a download writes (size in meta may be larger than data) */
  media: Record<string, { meta: Omit<DriveFileMeta, 'id'>; data: Buffer }> = {};
  /** googleIds whose token should fail (reconnect) */
  revoked = new Set<string>();

  reset() {
    this.files = { ...(driveFixtures as Record<string, string>) };
    this.media = {};
    this.revoked.clear();
  }

  async readText(t: TeacherCredentials, fileId: string): Promise<string | null> {
    if (this.revoked.has(t.googleId)) throw new ClassroomAuthError();
    if (this.media[fileId]) return null;
    const text = this.files[fileId];
    if (text === undefined) throw new Error(`File not found: ${fileId}`);
    return text;
  }

  async meta(t: TeacherCredentials, fileId: string): Promise<DriveFileMeta> {
    if (this.revoked.has(t.googleId)) throw new ClassroomAuthError();
    const m = this.media[fileId];
    if (m) return { id: fileId, ...m.meta };
    if (this.files[fileId] !== undefined) return { id: fileId, name: fileId, mimeType: 'application/vnd.google-apps.document', size: 0 };
    throw new Error(`File not found: ${fileId}`);
  }

  async download(t: TeacherCredentials, fileId: string, dest: string, maxBytes: number): Promise<number> {
    if (this.revoked.has(t.googleId)) throw new ClassroomAuthError();
    const m = this.media[fileId];
    if (!m) throw new Error(`File not found: ${fileId}`);
    if (m.data.length > maxBytes) throw new FileTooLargeError();
    await writeFile(dest, m.data);
    return m.data.length;
  }
}
