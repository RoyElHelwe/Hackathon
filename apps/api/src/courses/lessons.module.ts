import { Module } from '@nestjs/common';
import { config } from '../config';
import { MissionsModule } from '../missions/missions.module';
import { DRIVE_READER, FakeDriveReader, GoogleDriveReader } from './drive-reader';
import { LessonContentService } from './lesson-content.service';
import { LessonGamifyService } from './lesson-gamify.service';
import { LessonsController } from './lessons.controller';
import { FakeMediaTools, FfmpegMediaTools, MEDIA_TOOLS } from './media-tools';

/** "Gamify with AI" on course lessons (Drive content → AI skill + mission templates). */
@Module({
  imports: [MissionsModule],
  controllers: [LessonsController],
  providers: [
    { provide: DRIVE_READER, useFactory: () => (config.CLASSROOM_PROVIDER === 'google' ? new GoogleDriveReader() : new FakeDriveReader()) },
    { provide: MEDIA_TOOLS, useFactory: () => (config.CLASSROOM_PROVIDER === 'google' ? new FfmpegMediaTools() : new FakeMediaTools()) },
    LessonContentService,
    LessonGamifyService,
  ],
  exports: [LessonGamifyService, LessonContentService, DRIVE_READER, MEDIA_TOOLS],
})
export class LessonsModule {}
