import { Module } from '@nestjs/common';
import { MissionsModule } from '../missions/missions.module';
import { PeerReviewsService } from '../peer-reviews/peer-reviews.service';
import { PeerReviewsController, SubmissionsController, TeacherReviewsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { ValidationService } from './validation.service';

/** Submissions, peer reviews and teacher reviews share one module: they drive the same state machine. */
@Module({
  imports: [MissionsModule],
  controllers: [SubmissionsController, PeerReviewsController, TeacherReviewsController],
  providers: [SubmissionsService, PeerReviewsService, ValidationService],
  exports: [SubmissionsService, PeerReviewsService, ValidationService],
})
export class SubmissionsModule {}
