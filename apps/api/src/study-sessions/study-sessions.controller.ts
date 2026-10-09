import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { createStudySessionBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { StudySessionsService } from './study-sessions.service';

@Controller()
export class StudySessionsController {
  constructor(private readonly sessions: StudySessionsService) {}

  @Can('write', 'study_session')
  @Get('study-sessions/classmates')
  classmates(@Auth() a: AuthContext, @Query('topicId') topicId?: string) {
    return this.sessions.classmates(a, typeof topicId === 'string' && topicId ? topicId.slice(0, 64) : undefined);
  }

  @Can('write', 'study_session')
  @Post('study-sessions')
  create(@Auth() a: AuthContext, @Body(new ZodPipe(createStudySessionBody)) body: z.infer<typeof createStudySessionBody>) {
    return this.sessions.create(a, body);
  }

  @Can('write', 'study_session')
  @Get('study-sessions/live')
  live(@Auth() a: AuthContext) {
    return this.sessions.live(a);
  }

  @Can('read', 'study_session')
  @Get('study-sessions/mine')
  mine(@Auth() a: AuthContext) {
    return this.sessions.mine(a);
  }

  @Can('read', 'study_session')
  @Get('study-sessions/:id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.sessions.get(a, id);
  }

  @Can('write', 'study_session')
  @Post('study-sessions/:id/accept')
  accept(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.sessions.accept(a, id);
  }

  @Can('write', 'study_session')
  @Post('study-sessions/:id/decline')
  decline(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.sessions.decline(a, id);
  }

  @Can('write', 'study_session')
  @Post('study-sessions/:id/end')
  end(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.sessions.end(a, id);
  }

  @Can('read', 'study_session')
  @Get('study-sessions/:id/cards')
  cards(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.sessions.cards(a, id);
  }

  @Can('read', 'study_session')
  @Get('classes/:id/study-sessions')
  forClass(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.sessions.forClass(a, id);
  }
}
