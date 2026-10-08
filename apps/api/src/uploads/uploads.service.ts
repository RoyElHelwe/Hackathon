import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { Target } from '@tajriba/shared';
import sharp from 'sharp';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { uploadRoot } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { averageHash } from './phash';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
/** Longest side kept for photos: plenty for grading, keeps DB rows small. */
const MAX_IMAGE_SIDE = 2400;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
/** Audio from MediaRecorder (Chrome: webm/opus, Firefox: ogg, Safari: mp4/m4a). Stored as-is. */
const AUDIO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
};

/** Metadata only — never select `data` unless the bytes are needed. */
const meta = { id: true, ownerId: true, schoolId: true, kind: true, path: true, mime: true, bytes: true, phash: true, createdAt: true } as const;

export interface IncomingFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

const baseMime = (m: string | undefined) => (m ?? '').split(';')[0].trim().toLowerCase();

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
  ) {}

  /** Logical key `{schoolId}/{yyyy-mm}/{uuid}.ext` (also the on-disk layout for legacy rows). */
  private key(schoolId: string, ext: string, now = new Date()) {
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    return path.posix.join(schoolId, month, `${randomUUID()}.${ext}`);
  }

  async create(a: AuthContext, file: IncomingFile | undefined) {
    const actor = await this.actors.assert(a, 'write', 'upload', { schoolId: a.active?.schoolId, ownerId: a.userId });
    if (!file?.buffer?.length) throw new BadRequestException({ message: 'Choose a file to upload.' });
    const mime = baseMime(file.mimetype);

    let row: { kind: 'IMAGE' | 'AUDIO'; mime: string; ext: string; data: Buffer; phash: string | null };
    if (AUDIO_EXT[mime]) {
      if (file.size > MAX_AUDIO_BYTES) throw new PayloadTooLargeException({ message: 'Audio recordings can be at most 5 MB.' });
      row = { kind: 'AUDIO', mime, ext: AUDIO_EXT[mime], data: file.buffer, phash: null };
    } else if (IMAGE_MIMES.has(mime) || mime === 'application/octet-stream' || mime === '') {
      if (file.size > MAX_IMAGE_BYTES) throw new PayloadTooLargeException({ message: 'Photos can be at most 8 MB.' });
      row = { kind: 'IMAGE', ...(await this.processImage(file.buffer)) };
    } else {
      throw new BadRequestException({ message: 'Only photos (JPG, PNG, WEBP) or audio recordings (WEBM, OGG, M4A) are allowed.' });
    }

    const up = await this.prisma.upload.create({
      data: {
        ownerId: actor.userId,
        schoolId: actor.schoolId,
        kind: row.kind,
        path: this.key(actor.schoolId, row.ext),
        mime: row.mime,
        bytes: row.data.length,
        phash: row.phash,
        data: new Uint8Array(row.data),
      },
      select: meta,
    });
    return { id: up.id, kind: up.kind, mime: up.mime, bytes: up.bytes, createdAt: up.createdAt };
  }

  /**
   * Re-encodes with sharp: `.rotate()` bakes in the EXIF orientation, and the
   * re-encode drops all metadata (EXIF, GPS). HEIC/HEIF becomes JPEG.
   */
  private async processImage(input: Buffer): Promise<{ mime: string; ext: string; data: Buffer; phash: string }> {
    let format: string | undefined;
    try {
      format = (await sharp(input).metadata()).format;
    } catch {
      throw new BadRequestException({ message: 'We could not read this photo. Please send a JPG, PNG or WEBP.' });
    }
    if (!format || !['jpeg', 'png', 'webp', 'heif'].includes(format)) {
      throw new BadRequestException({ message: 'Only JPG, PNG or WEBP photos are allowed.' });
    }
    try {
      const img = sharp(input).rotate().resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true });
      let out: { mime: string; ext: string; data: Buffer };
      if (format === 'png') out = { mime: 'image/png', ext: 'png', data: await img.png().toBuffer() };
      else if (format === 'webp') out = { mime: 'image/webp', ext: 'webp', data: await img.webp({ quality: 85 }).toBuffer() };
      else out = { mime: 'image/jpeg', ext: 'jpg', data: await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer() };
      return { ...out, phash: await averageHash(out.data) };
    } catch {
      // Typically HEIC with a codec the bundled libvips can't decode.
      throw new BadRequestException({
        message: format === 'heif' ? 'We could not convert this HEIC photo. Please send it as JPG or PNG.' : 'We could not read this photo. Please send a JPG, PNG or WEBP.',
      });
    }
  }

  /** File bytes by logical path: DB first, then legacy on-disk copy under UPLOAD_DIR. */
  async readFile(p: string): Promise<Buffer> {
    const row = await this.prisma.upload.findFirst({ where: { path: p }, select: { data: true } });
    if (row?.data) return Buffer.from(row.data);
    return this.readFromDisk(p);
  }

  private async readFromDisk(p: string): Promise<Buffer> {
    const root = path.resolve(uploadRoot());
    const abs = path.resolve(root, p);
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new NotFoundException('File not found');
    try {
      return await readFile(abs);
    } catch {
      throw new NotFoundException('File not found');
    }
  }

  /**
   * GET /uploads/:id — object-level check (CLAUDE.md §4): director/admin = same school;
   * teacher = uploads on submissions in classes they teach (or their own);
   * student = own + uploads on submissions they are the assigned peer evaluator for;
   * parent = verified children's uploads. Default deny.
   */
  async get(a: AuthContext, id: string) {
    const up = await this.prisma.upload.findUnique({ where: { id }, select: meta });
    if (!up) throw new NotFoundException('File not found');
    const actor = await this.actors.actor(a);
    const base: Target = { schoolId: up.schoolId, ownerId: up.ownerId };
    const usedIn = { OR: [{ photoUploadIds: { has: id } }, { audioUploadId: id }] };

    const targets: Target[] = [base];
    if (actor.role === 'TEACHER') {
      const subs = await this.prisma.submission.findMany({ where: usedIn, select: { mission: { select: { classId: true } } } });
      for (const s of subs) if (s.mission.classId) targets.push({ ...base, classId: s.mission.classId });
    } else if (actor.role === 'STUDENT' && up.ownerId !== actor.userId) {
      const assigned = await this.prisma.peerEvaluation.count({ where: { evaluatorId: actor.userId, submission: usedIn } });
      if (assigned > 0) targets.push({ ...base, assignedToActor: true });
    }
    const checks = await Promise.all(targets.map((t) => this.actors.check(a, 'read', 'upload', t)));
    if (!checks.some(Boolean)) throw new ForbiddenException('You do not have access to this.');

    const row = await this.prisma.upload.findUnique({ where: { id }, select: { data: true } });
    const data = row?.data ? Buffer.from(row.data) : await this.readFromDisk(up.path);
    return { mime: up.mime, data };
  }
}
