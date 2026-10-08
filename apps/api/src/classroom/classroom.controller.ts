import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { importClassesBody } from '@tajriba/shared';
import { classroomAuthUrl } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { config } from '../config';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { ClassroomService } from './classroom.service';

@Controller('classroom')
export class ClassroomController {
  constructor(
    private readonly classroom: ClassroomService,
    private readonly auth: AuthService,
  ) {}

  /** Incremental OAuth: asks for Classroom scopes with offline access. Fake mode connects instantly. */
  @Can('write', 'class')
  @Get('connect')
  async connect(@Auth() a: AuthContext, @Res() res: Response) {
    if (this.classroom.kind === 'fake' || !this.auth.googleEnabled()) {
      await this.classroom.connectFake(a.userId);
      return res.redirect(`${config.WEB_URL}/teacher/onboarding?step=import`);
    }
    return res.redirect(await classroomAuthUrl(this.auth, a.userId));
  }

  @Can('read', 'class')
  @Get('courses')
  courses(@Auth() a: AuthContext) {
    return this.classroom.listCourses(a);
  }

  @Can('write', 'class')
  @Post('import')
  import(@Auth() a: AuthContext, @Body(new ZodPipe(importClassesBody)) body: { courseIds: string[] }) {
    return this.classroom.import(a, body.courseIds);
  }
}
