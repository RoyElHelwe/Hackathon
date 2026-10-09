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

  async readText(t: TeacherCredentials, fileId: string): Promise<string | null> {
    if (!t.refreshToken) throw new ClassroomAuthError('Google Classroom is not connected');
    const auth = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
    auth.setCredentials({ refresh_token: t.refreshToken });
    const drive = google.drive({ version: 'v3', auth });
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
  /** googleIds whose token should fail (reconnect) */
  revoked = new Set<string>();

  reset() {
    this.files = { ...(driveFixtures as Record<string, string>) };
    this.revoked.clear();
  }

  async readText(t: TeacherCredentials, fileId: string): Promise<string | null> {
    if (this.revoked.has(t.googleId)) throw new ClassroomAuthError();
    const text = this.files[fileId];
    if (text === undefined) throw new Error(`File not found: ${fileId}`);
    return text;
  }
}
