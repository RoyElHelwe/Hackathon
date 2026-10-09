import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AiModule } from './ai/ai.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AssistantModule } from './assistant/assistant.module';
import { RosterModule } from './roster/roster.module';
import { TimetableModule } from './timetable/timetable.module';
import { AuthModule } from './auth/auth.module';
import { ClassesModule } from './classes/classes.module';
import { ClassroomModule } from './classroom/classroom.module';
import { PolicyGuard, SessionGuard } from './common/guards';
import { CoursesModule } from './courses/courses.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { FamiliesModule } from './families/families.module';
import { GamificationModule } from './gamification/gamification.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { LessonsModule } from './courses/lessons.module';
import { MessagesModule } from './messages/messages.module';
import { MissionsModule } from './missions/missions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ParentsModule } from './parents/parents.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RecordingsModule } from './recordings/recordings.module';
import { StudySessionsModule } from './study-sessions/study-sessions.module';
import { ExamsModule } from './exams/exams.module';
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
    RealtimeModule,
    AiModule,
    ClassroomModule,
    CoursesModule,
    ProgressModule,
    GamificationModule,
    UploadsModule,
    SchoolsModule,
    ClassesModule,
    SubjectsModule,
    MissionsModule,
    LessonsModule,
    SubmissionsModule,
    FamiliesModule,
    ParentsModule,
    MessagesModule,
    DashboardsModule,
    RecordingsModule,
    StudySessionsModule,
    ExamsModule,
    AnnouncementsModule,
    TimetableModule,
    RosterModule,
    AssistantModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
  ],
})
export class AppModule {}
