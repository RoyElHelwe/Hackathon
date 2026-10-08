import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { ClassroomModule } from './classroom/classroom.module';
import { PolicyGuard, SessionGuard } from './common/guards';
import { DashboardsModule } from './dashboards/dashboards.module';
import { FamiliesModule } from './families/families.module';
import { GamificationModule } from './gamification/gamification.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { MessagesModule } from './messages/messages.module';
import { MissionsModule } from './missions/missions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ParentsModule } from './parents/parents.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { SchoolsModule } from './schools/schools.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    AiModule,
    ClassroomModule,
    ProgressModule,
    GamificationModule,
    UploadsModule,
    SchoolsModule,
    ClassesModule,
    SubjectsModule,
    MissionsModule,
    SubmissionsModule,
    FamiliesModule,
    ParentsModule,
    MessagesModule,
    DashboardsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
  ],
})
export class AppModule {}
