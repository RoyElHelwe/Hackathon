import { Body, Controller, Get, Post } from '@nestjs/common';
import { walletGrantBody } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { ActorService } from '../common/actor.service';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';

@Controller()
export class GamificationController {
  constructor(
    private readonly gamification: GamificationService,
    private readonly actors: ActorService,
    private readonly prisma: PrismaService,
  ) {}

  @Can('read', 'progress')
  @Get('gamification/me')
  me(@Auth() a: AuthContext) {
    return this.gamification.me(a.userId);
  }

  @Can('read', 'progress')
  @Get('progress/me')
  progress(@Auth() a: AuthContext) {
    return this.gamification.progressMe(a.userId);
  }

  /** Teachers can grant evaluation points (42-style wallet). */
  @Can('override', 'peer_evaluation')
  @Post('gamification/wallet/grant')
  async grant(@Auth() a: AuthContext, @Body(new ZodPipe(walletGrantBody)) body: { studentId: string; points: number }) {
    const enr = await this.prisma.enrollment.findMany({ where: { studentId: body.studentId, status: 'ACTIVE' } });
    const actor = await this.actors.actor(a);
    const classId = enr.find((e) => actor.classIdsTaught?.includes(e.classId))?.classId;
    await this.actors.assert(a, 'override', 'peer_evaluation', { classId });
    await this.gamification.walletDelta(body.studentId, body.points, 'TEACHER_GRANT', a.userId);
    return { ok: true };
  }
}
