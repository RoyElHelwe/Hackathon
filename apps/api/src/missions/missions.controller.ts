import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { approveMissionBody, generateMissionsBody, updateMissionBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { MissionsService } from './missions.service';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Can('write', 'mission_draft')
  @Post('generate')
  generate(@Auth() a: AuthContext, @Body(new ZodPipe(generateMissionsBody)) body: z.infer<typeof generateMissionsBody>) {
    return this.missions.generate(a, body);
  }

  @Can('read', 'mission')
  @Get()
  list(
    @Auth() a: AuthContext,
    @Query('classId') classId?: string,
    @Query('status') status?: string,
    @Query('topicId') topicId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.missions.list(a, { classId, status, topicId, courseId });
  }

  @Can('read', 'mission')
  @Get(':id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.missions.get(a, id);
  }

  @Can('write', 'mission_draft')
  @Patch(':id')
  update(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(updateMissionBody)) body: z.infer<typeof updateMissionBody>) {
    return this.missions.update(a, id, body);
  }

  @Can('write', 'mission_draft')
  @Post(':id/safety-check')
  safety(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.missions.safetyCheck(a, id);
  }

  @Can('write', 'mission_draft')
  @Post(':id/approve')
  approve(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(approveMissionBody)) body: z.infer<typeof approveMissionBody>) {
    return this.missions.approve(a, id, body);
  }

  @Can('write', 'mission_draft')
  @Post(':id/archive')
  archive(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.missions.archive(a, id);
  }
}
