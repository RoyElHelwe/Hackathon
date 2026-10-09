import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { gamifyLessonBody, GamifyLessonBody } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { LessonGamifyService } from './lesson-gamify.service';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly gamify: LessonGamifyService) {}

  /** 202: the work continues in the background; poll GET /courses/:id/lessons for the status. */
  @Can('write', 'course')
  @Post(':id/gamify')
  @HttpCode(202)
  start(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(gamifyLessonBody)) body: GamifyLessonBody) {
    return this.gamify.start(a, id, body?.count);
  }
}
