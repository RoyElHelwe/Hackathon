import { Global, Module } from '@nestjs/common';
import { ClassCourseController, CoursesController } from './courses.controller';
import { CourseMissionsService } from './course-missions.service';
import { CoursesService } from './courses.service';
import { LessonSyncService } from './lesson-sync.service';

@Global()
@Module({
  controllers: [CoursesController, ClassCourseController],
  providers: [CoursesService, LessonSyncService, CourseMissionsService],
  exports: [CoursesService, LessonSyncService, CourseMissionsService],
})
export class CoursesModule {}
