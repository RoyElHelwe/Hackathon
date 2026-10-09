import { Module } from '@nestjs/common';
import { ExamsModule } from '../exams/exams.module';
import { StudySessionsModule } from '../study-sessions/study-sessions.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { JobsService } from './jobs.service';

@Module({ imports: [SubmissionsModule, ExamsModule, StudySessionsModule], providers: [JobsService] })
export class JobsModule {}
