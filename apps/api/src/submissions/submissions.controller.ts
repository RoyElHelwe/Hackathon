import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { completePeerReviewBody, followUpBody, hintBody, rateReviewBody, startSubmissionBody, submitBody, teacherReviewBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PeerReviewsService } from '../peer-reviews/peer-reviews.service';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Can('write', 'submission')
  @Post()
  start(@Auth() a: AuthContext, @Body(new ZodPipe(startSubmissionBody)) body: { missionId: string }) {
    return this.submissions.start(a, body.missionId);
  }

  @Can('write', 'submission')
  @Get('mine')
  mine(@Auth() a: AuthContext) {
    return this.submissions.mine(a);
  }

  @Can('read', 'submission')
  @Get(':id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.submissions.get(a, id);
  }

  @Can('write', 'submission')
  @Post(':id/hint')
  hint(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(hintBody)) body: { partialWork?: string }) {
    return this.submissions.hint(a, id, body.partialWork);
  }

  @Can('write', 'submission')
  @Post(':id/submit')
  submit(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(submitBody)) body: z.infer<typeof submitBody>) {
    return this.submissions.submit(a, id, body);
  }

  @Can('write', 'submission')
  @Post(':id/check')
  check(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.submissions.runCheck(a, id);
  }

  @Can('write', 'submission')
  @Post(':id/follow-up')
  followUp(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(followUpBody)) body: { answer: string }) {
    return this.submissions.followUp(a, id, body.answer);
  }

  @Can('write', 'submission')
  @Post(':id/retry')
  retry(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.submissions.retry(a, id);
  }

  @Can('review', 'submission')
  @Post(':id/teacher-review')
  teacherReview(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(teacherReviewBody)) body: { score: number; comment?: string }) {
    return this.submissions.teacherReview(a, id, body);
  }
}

@Controller('teacher')
export class TeacherReviewsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Can('review', 'submission')
  @Get('review-queue')
  queue(@Auth() a: AuthContext, @Query('classId') classId?: string) {
    return this.submissions.reviewQueue(a, classId);
  }
}

@Controller('peer-reviews')
export class PeerReviewsController {
  constructor(private readonly peers: PeerReviewsService) {}

  @Can('write', 'peer_evaluation')
  @Get('assigned')
  assigned(@Auth() a: AuthContext) {
    return this.peers.assigned(a);
  }

  @Can('read', 'peer_evaluation')
  @Get(':id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.peers.get(a, id);
  }

  @Can('write', 'peer_evaluation')
  @Post(':id/complete')
  complete(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(completePeerReviewBody)) body: z.infer<typeof completePeerReviewBody>) {
    return this.peers.complete(a, id, body);
  }

  @Can('write', 'submission')
  @Post(':id/rate')
  rate(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(rateReviewBody)) body: { helpfulRating: number }) {
    return this.peers.rate(a, id, body.helpfulRating);
  }
}
