import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { createSubjectBody, updateSubjectBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { SchoolSubjectsService } from './school-subjects.service';

@Controller('schools/:schoolId/subjects')
export class SchoolSubjectsController {
  constructor(private readonly subjects: SchoolSubjectsService) {}

  @Can('read', 'subject')
  @Get()
  list(@Auth() a: AuthContext, @Param('schoolId') schoolId: string) {
    return this.subjects.list(a, schoolId);
  }

  @Can('write', 'subject')
  @Post()
  create(@Auth() a: AuthContext, @Param('schoolId') schoolId: string, @Body(new ZodPipe(createSubjectBody)) body: z.infer<typeof createSubjectBody>) {
    return this.subjects.create(a, schoolId, body);
  }

  @Can('write', 'subject')
  @Patch(':subjectId')
  update(
    @Auth() a: AuthContext,
    @Param('schoolId') schoolId: string,
    @Param('subjectId') subjectId: string,
    @Body(new ZodPipe(updateSubjectBody)) body: z.infer<typeof updateSubjectBody>,
  ) {
    return this.subjects.update(a, schoolId, subjectId, body);
  }

  @Can('write', 'subject')
  @Delete(':subjectId')
  remove(@Auth() a: AuthContext, @Param('schoolId') schoolId: string, @Param('subjectId') subjectId: string) {
    return this.subjects.remove(a, schoolId, subjectId);
  }
}
