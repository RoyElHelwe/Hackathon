import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { startRecordingBody } from '@tajriba/shared';
import { memoryStorage } from 'multer';
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

  @Can('read', 'recording')
  @Get(':id/audio')
  @Header('Cache-Control', 'private, max-age=60')
  @Header('X-Content-Type-Options', 'nosniff')
  async audio(@Auth() a: AuthContext, @Param('id') id: string) {
    const f = await this.recordings.audio(a, id);
    return new StreamableFile(f.data, { type: f.mime, length: f.data.length, disposition: 'inline' });
  }
}
