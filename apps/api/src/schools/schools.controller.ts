import { Body, Controller, Get, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createInviteBody, createSchoolBody, joinSchoolBody, Role, schoolSettingsBody, setTeacherSubjectsBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { AuthContext } from '../common/auth-context';
import { Auth, Can, Public } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly schools: SchoolsService,
    private readonly auth: AuthService,
  ) {}

  /** Any signed-in user can create a school and becomes its director. */
  @Can('write', 'self')
  @Post()
  async create(
    @Auth() a: AuthContext,
    @Body(new ZodPipe(createSchoolBody)) body: z.infer<typeof createSchoolBody>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { school, membershipId } = await this.schools.create(a, body);
    await this.auth.issue(res, { sub: a.userId, mid: membershipId });
    return school;
  }

  @Can('write', 'self')
  @Post('join')
  join(@Auth() a: AuthContext, @Body(new ZodPipe(joinSchoolBody)) body: z.infer<typeof joinSchoolBody>) {
    return this.schools.join(a, body.code, body.role, body.subjectIds);
  }

  @Can('read', 'self')
  @Get('by-code/:code/subjects')
  subjectsByCode(@Param('code') code: string) {
    return this.schools.subjectsByCode(code);
  }

  @Can('read', 'school')
  @Get(':id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.schools.get(a, id);
  }

  @Can('read', 'members')
  @Get(':id/members')
  members(@Auth() a: AuthContext, @Param('id') id: string, @Query('status') status?: string) {
    return this.schools.members(a, id, status);
  }

  @Can('write', 'school')
  @Patch(':id/settings')
  settings(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(schoolSettingsBody)) body: z.infer<typeof schoolSettingsBody>) {
    return this.schools.updateSettings(a, id, body);
  }
}

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly schools: SchoolsService) {}

  @Can('read', 'members')
  @Post(':id/approve')
  approve(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.schools.decide(a, id, 'APPROVED');
  }

  @Can('read', 'members')
  @Post(':id/reject')
  reject(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.schools.decide(a, id, 'REJECTED');
  }

  @Can('write', 'members')
  @Put(':id/subjects')
  setSubjects(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(setTeacherSubjectsBody)) body: z.infer<typeof setTeacherSubjectsBody>) {
    return this.schools.setTeacherSubjects(a, id, body.subjectIds);
  }
}

@Controller('invites')
export class InvitesController {
  constructor(
    private readonly schools: SchoolsService,
    private readonly auth: AuthService,
  ) {}

  @Can('write', 'self')
  @Post()
  create(@Auth() a: AuthContext, @Body(new ZodPipe(createInviteBody)) body: { email: string; role: Role; studentId?: string; subjectIds?: string[] }) {
    return this.schools.createInvite(a, body);
  }

  @Public()
  @Get(':token')
  get(@Param('token') token: string) {
    return this.schools.getInvite(token);
  }

  @Can('write', 'self')
  @Post(':token/accept')
  async accept(@Auth() a: AuthContext, @Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.schools.acceptInvite(a, token);
    await this.auth.issue(res, { sub: a.userId, mid: r.membershipId });
    return r;
  }
}
