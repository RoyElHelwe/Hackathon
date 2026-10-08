import { Module } from '@nestjs/common';
import { SchoolSubjectsController } from './school-subjects.controller';
import { SchoolSubjectsService } from './school-subjects.service';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  controllers: [SubjectsController, SchoolSubjectsController],
  providers: [SubjectsService, SchoolSubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
