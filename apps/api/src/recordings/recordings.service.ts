import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import type { Target } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
/** ~24 kbps Opus is ~180 KB/min, so 60 MB covers hours; this only stops runaway clients. */
export const MAX_RECORDING_BYTES = 60 * 1024 * 1024;

export type RecordingKind = 'STUDY' | 'EXAM';

export interface ChunkFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/**
 * Mic recordings of study sessions and exam rooms. Each participant records their own microphone in the browser
 * (MediaRecorder, 10 s timeslices) and uploads ordered chunks; concatenated chunks of one MediaRecorder are a valid file.
 */
@Injectable()
export class RecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: ActorService,
  ) {}

  /** Permission facts for a study session / exam attempt and whether it is still live (accepting recordings). */
  async context(kind: RecordingKind, refId: string): Promise<{ target: Target; live: boolean; participants: string[] }> {
    if (kind === 'STUDY') {
      const s = await this.prisma.studySession.findUnique({ where: { id: refId }, include: { participants: true, class: { select: { schoolId: true } } } });
      if (!s) throw new NotFoundException();
      const participants = s.participants.map((p) => p.userId);
      return { target: { schoolId: s.class.schoolId, classId: s.classId, participantIds: participants }, live: s.status === 'ACTIVE' || s.status === 'INVITED', participants };
    }
    const a = await this.prisma.examAttempt.findUnique({ where: { id: refId }, include: { exam: { select: { classId: true, schoolId: true } } } });
    if (!a) throw new NotFoundException();
    return {
      target: { schoolId: a.exam.schoolId, classId: a.exam.classId, participantIds: [a.studentId] },
      live: a.status === 'IN_PROGRESS' || a.status === 'NOT_STARTED',
      participants: [a.studentId],
    };
  }

  async start(a: AuthContext, body: { kind: RecordingKind; refId: string; mime: string }) {
    const ctx = await this.context(body.kind, body.refId);
    await this.actors.assert(a, 'write', 'recording', { ...ctx.target, ownerId: a.userId });
    if (!ctx.participants.includes(a.userId)) throw new ForbiddenException('You are not part of this session.');
    if (!ctx.live) throw new ConflictException({ message: 'This session has ended.', code: 'ENDED' });
    const rec = await this.prisma.recording.create({
      data: { kind: body.kind, refId: body.refId, userId: a.userId, schoolId: a.active!.schoolId, mime: body.mime.split(';')[0] },
    });
    return { id: rec.id };
  }

  /** Idempotent per (recording, seq): a retried chunk upload is a no-op. */
  async chunk(a: AuthContext, id: string, seq: number, file: ChunkFile | undefined) {
    if (!Number.isInteger(seq) || seq < 0 || seq > 100_000) throw new BadRequestException('Bad chunk number.');
    if (!file?.buffer?.length) throw new BadRequestException('Empty chunk.');
    if (file.size > MAX_CHUNK_BYTES) throw new PayloadTooLargeException();
    const rec = await this.prisma.recording.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException();
    if (rec.userId !== a.userId) throw new ForbiddenException('You do not have access to this.');
    if (rec.bytes + file.size > MAX_RECORDING_BYTES) throw new PayloadTooLargeException();
    try {
      await this.prisma.$transaction([
        this.prisma.recordingChunk.create({ data: { recordingId: id, seq, data: new Uint8Array(file.buffer) } }),
        this.prisma.recording.update({ where: { id }, data: { bytes: { increment: file.size } } }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: true, duplicate: true };
      throw e;
    }
    return { ok: true };
  }

  async stop(a: AuthContext, id: string) {
    const rec = await this.prisma.recording.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException();
    if (rec.userId !== a.userId) throw new ForbiddenException('You do not have access to this.');
    await this.prisma.recording.update({ where: { id }, data: { endedAt: rec.endedAt ?? new Date() } });
    return { ok: true };
  }

  /** Recordings of a session (teacher of the class, participants). */
  async list(a: AuthContext, kind: RecordingKind, refId: string) {
    const ctx = await this.context(kind, refId);
    await this.actors.assert(a, 'read', 'recording', ctx.target);
    const rows = await this.prisma.recording.findMany({
      where: { kind, refId, bytes: { gt: 0 } },
      orderBy: { startedAt: 'asc' },
      include: { _count: { select: { chunks: true } } },
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true } });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: users.find((u) => u.id === r.userId)?.name ?? '',
      mime: r.mime,
      bytes: r.bytes,
      chunks: r._count.chunks,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
    }));
  }

  async audio(a: AuthContext, id: string): Promise<{ data: Buffer; mime: string }> {
    const rec = await this.prisma.recording.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException();
    const ctx = await this.context(rec.kind as RecordingKind, rec.refId);
    await this.actors.assert(a, 'read', 'recording', { ...ctx.target, ownerId: rec.userId });
    const chunks = await this.prisma.recordingChunk.findMany({ where: { recordingId: id }, orderBy: { seq: 'asc' }, select: { data: true } });
    return { data: Buffer.concat(chunks.map((c) => Buffer.from(c.data))), mime: rec.mime };
  }
}
