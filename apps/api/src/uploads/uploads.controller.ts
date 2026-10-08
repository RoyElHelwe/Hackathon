import { Controller, Get, Header, Param, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { IncomingFile, MAX_IMAGE_BYTES, UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Multipart field `file`. Images ≤ 8 MB (re-encoded, EXIF stripped), audio ≤ 5 MB. */
  @Can('write', 'upload')
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  create(@Auth() a: AuthContext, @UploadedFile() file: IncomingFile | undefined) {
    return this.uploads.create(a, file);
  }

  @Can('read', 'upload')
  @Get(':id')
  @Header('Cache-Control', 'private, max-age=86400')
  @Header('X-Content-Type-Options', 'nosniff')
  async get(@Auth() a: AuthContext, @Param('id') id: string) {
    const f = await this.uploads.get(a, id);
    return new StreamableFile(f.data, { type: f.mime, length: f.data.length, disposition: 'inline' });
  }
}
