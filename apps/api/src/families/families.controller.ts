import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { familyConfirmBody, familyLinkBody } from '@tajriba/shared';
import { AuthService } from '../auth/auth.service';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { FamiliesService } from './families.service';

@Controller('families')
export class FamiliesController {
  constructor(
    private readonly families: FamiliesService,
    private readonly auth: AuthService,
  ) {}

  @Can('write', 'family')
  @Post('code')
  code(@Auth() a: AuthContext) {
    return this.families.createCode(a);
  }

  /** Any signed-in user can link a child (they become a parent). */
  @Can('write', 'self')
  @Post('link')
  async link(@Auth() a: AuthContext, @Body(new ZodPipe(familyLinkBody)) body: { code: string }, @Res({ passthrough: true }) res: Response) {
    const r = await this.families.link(a, body.code);
    await this.auth.issue(res, { sub: a.userId, mid: r.membershipId });
    return r;
  }

  @Can('read', 'family')
  @Get('missions')
  missions(@Auth() a: AuthContext) {
    return this.families.familyMissions(a);
  }

  @Can('read', 'family')
  @Post('missions/:submissionId/confirm')
  confirm(@Auth() a: AuthContext, @Param('submissionId') id: string, @Body(new ZodPipe(familyConfirmBody)) body: { note?: string }) {
    return this.families.confirm(a, id, body.note);
  }
}
