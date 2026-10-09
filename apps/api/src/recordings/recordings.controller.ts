import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { startRecordingBody } from '@tajriba/shared';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ChunkFile, MAX_CHUNK_BYTES, RecordingKind, RecordingsService } from './recordings.service';

const listQuery = z.object({ kind: z.enum(['STUDY', 'EXAM']), refId: z.string().min(1) });

@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @Can('write', 'recording')
  @Post()
  start(@Auth() a: AuthContext, @Body(new ZodPipe(startRecordingBody)) body: z.infer<typeof startRecordingBody>) {
    return this.recordings.start(a, body);
  }

  /** Multipart field `chunk`, query `seq` (0, 1, 2…). */
  @Can('write', 'recording')
  @Post(':id/chunks')
  @UseInterceptors(FileInterceptor('chunk', { storage: memoryStorage(), limits: { fileSize: MAX_CHUNK_BYTES, files: 1 } }))
  chunk(@Auth() a: AuthContext, @Param('id') id: string, @Query('seq', ParseIntPipe) seq: number, @UploadedFile() file: ChunkFile | undefined) {
    return this.recordings.chunk(a, id, seq, file);
  }

  @Can('write', 'recording')
  @Post(':id/stop')
  stop(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.recordings.stop(a, id);
  }

  @Can('read', 'recording')
  @Get()
  list(@Auth() a: AuthContext, @Query(new ZodPipe(listQuery)) q: { kind: RecordingKind; refId: string }) {
    return this.recordings.list(a, q.kind, q.refId);
  }

  /** Streams the audio with HTTP Range support (Safari needs 206 to play; all browsers need it to seek). */
  @Can('read', 'recording')
  @Get(':id/audio')
  async audio(@Auth() a: AuthContext, @Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const f = await this.recordings.audioInfo(a, id);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    const range = parseRange(req.headers.range, f.total);
    if (range === 'unsatisfiable') {
      res.status(416).setHeader('Content-Range', `bytes */${f.total}`);
      res.end();
      return;
    }
    const [start, end] = range ?? [0, f.total - 1];
    if (range) {
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${f.total}`);
    }
    res.setHeader('Content-Length', String(Math.max(0, end - start + 1)));
    if (req.method === 'HEAD' || f.total === 0) {
      res.end();
      return;
    }
    await pipeline(Readable.from(this.recordings.readRange(id, f.chunks, start, end)), res).catch(() => res.destroy());
  }
}

/** One `bytes=` range (multi-range requests get the whole file). null = no/ignored Range header. */
export function parseRange(header: string | undefined, total: number): [number, number] | 'unsatisfiable' | null {
  const m = header?.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (!suffix || !total) return 'unsatisfiable';
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
  }
  if (start >= total || start > end) return 'unsatisfiable';
  return [start, end];
}
