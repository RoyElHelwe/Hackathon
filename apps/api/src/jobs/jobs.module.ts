import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { JobsService } from './jobs.service';

@Module({ imports: [SubmissionsModule], providers: [JobsService] })
export class JobsModule {}
