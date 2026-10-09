import { Module } from '@nestjs/common';
import { LessonsModule } from '../courses/lessons.module';
import { ExamPrepService } from './exam-prep.service';
import { ExamTranscribeService } from './exam-transcribe.service';
import { ExamRoomService } from './exam-room.service';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [LessonsModule],
  controllers: [ExamsController],
  providers: [ExamsService, ExamPrepService, ExamRoomService, ExamTranscribeService],
  exports: [ExamsService, ExamPrepService, ExamRoomService],
})
export class ExamsModule {}
