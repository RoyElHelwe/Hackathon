import { Global, Module } from '@nestjs/common';
import { ClassCourseController, CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { LessonSyncService } from './lesson-sync.service';

@Global()
@Module({
  controllers: [CoursesController, ClassCourseController],
  providers: [CoursesService, LessonSyncService],
  exports: [CoursesService, LessonSyncService],
})
export class CoursesModule {}
