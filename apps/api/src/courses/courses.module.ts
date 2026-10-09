import { Global, Module } from '@nestjs/common';
import { ClassCourseController, CoursesController } from './courses.controller';
import { CourseMissionsService } from './course-missions.service';
import { CoursesService } from './courses.service';
import { CurriculumService } from './curriculum.service';
import { LessonSyncService } from './lesson-sync.service';

@Global()
@Module({
  controllers: [CoursesController, ClassCourseController],
  providers: [CoursesService, LessonSyncService, CourseMissionsService, CurriculumService],
  exports: [CoursesService, LessonSyncService, CourseMissionsService, CurriculumService],
})
export class CoursesModule {}
