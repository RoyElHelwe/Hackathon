import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createExamBody, CreateExamBody, examAnswerBody, examReviewBody, updateExamBody, UpdateExamBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ExamRoomService } from './exam-room.service';
import { ExamsService } from './exams.service';
import { AnswerAudio, ExamTranscribeService, MAX_ANSWER_AUDIO_BYTES } from './exam-transcribe.service';

@Controller()
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly room: ExamRoomService,
    private readonly transcriber: ExamTranscribeService,
  ) {}

  // ---- teacher ----

  @Can('write', 'exam')
  @Post('exams')
  create(@Auth() a: AuthContext, @Body(new ZodPipe(createExamBody)) body: CreateExamBody) {
    return this.exams.create(a, body);
  }

  @Can('read', 'exam')
  @Get('exams')
  list(@Auth() a: AuthContext, @Query('classId') classId?: string) {
    return this.exams.list(a, classId || undefined);
  }

  // ---- student / parent (declared before :id) ----

  @Can('read', 'exam_attempt')
  @Get('exams/mine')
  mine(@Auth() a: AuthContext) {
    return this.exams.mine(a);
  }

  @Can('read', 'exam_attempt')
  @Get('exams/child/:studentId')
  child(@Auth() a: AuthContext, @Param('studentId') studentId: string) {
    return this.exams.forChild(a, studentId);
  }

  @Can('read', 'exam')
  @Get('exams/:id')
  detail(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.exams.detail(a, id);
  }

  @Can('write', 'exam')
  @Patch('exams/:id')
  update(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(updateExamBody)) body: UpdateExamBody) {
    return this.exams.update(a, id, body);
  }

  @Can('write', 'exam')
  @Post('exams/:id/prepare')
  prepare(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.exams.prepare(a, id);
  }

  @Can('write', 'exam')
  @Post('exams/:id/publish')
  publish(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.exams.publish(a, id);
  }

  @Can('write', 'exam')
  @Post('exams/:id/release-all')
  releaseAll(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.exams.releaseAll(a, id);
  }

  // ---- the interview room ----

  @Can('read', 'exam_attempt')
  @Get('exam-attempts/:id')
  attempt(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.room.state(a, id);
  }

  @Can('write', 'exam_attempt')
  @Post('exam-attempts/:id/start')
  start(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.room.start(a, id);
  }

  @Can('write', 'exam_attempt')
  @Post('exam-attempts/:id/answer')
  answer(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(examAnswerBody)) body: { text: string }) {
    return this.room.answer(a, id, body.text);
  }

  /** VR exam: spoken answer (audio) → text, for headsets without speech recognition. The student then sends it. */
  @Can('write', 'exam_attempt')
  @Post('exam-attempts/:id/transcribe')
  @UseInterceptors(FileInterceptor('audio', { storage: memoryStorage(), limits: { fileSize: MAX_ANSWER_AUDIO_BYTES, files: 1 } }))
  transcribe(@Auth() a: AuthContext, @Param('id') id: string, @UploadedFile() file: AnswerAudio | undefined) {
    return this.transcriber.transcribe(a, id, file);
  }

  @Can('write', 'exam_attempt')
  @Post('exam-attempts/:id/finish')
  finish(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.room.finishByStudent(a, id);
  }

  @Can('review', 'exam_attempt')
  @Post('exam-attempts/:id/review')
  review(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(examReviewBody)) body: z.infer<typeof examReviewBody>) {
    return this.exams.review(a, id, body);
  }
}
