import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { setClassCourseBody, SetClassCourseBody } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Can('read', 'course')
  @Get()
  mine(@Auth() a: AuthContext) {
    return this.courses.mine(a);
  }

  @Can('read', 'course')
  @Get(':id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.courses.get(a, id);
  }

  @Can('read', 'course')
  @Get(':id/lessons')
  lessons(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.courses.lessons(a, id);
  }

  @Can('write', 'course')
  @Post(':id/sync')
  sync(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.courses.sync(a, id);
  }
}

/** Section → course assignment lives under /classes. */
@Controller('classes')
export class ClassCourseController {
  constructor(private readonly courses: CoursesService) {}

  @Can('write', 'class')
  @Patch(':id/course')
  setCourse(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(setClassCourseBody)) body: SetClassCourseBody) {
    return this.courses.setClassCourse(a, id, body);
  }
}
