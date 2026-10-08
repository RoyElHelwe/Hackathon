import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { classSettingsBody } from '@tajriba/shared';
import { z } from 'zod';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { GamificationService } from '../gamification/gamification.service';
import { ClassesService } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(
    private readonly classes: ClassesService,
    private readonly gamification: GamificationService,
  ) {}

  @Can('read', 'class')
  @Get()
  mine(@Auth() a: AuthContext) {
    return this.classes.mine(a);
  }

  @Can('read', 'class')
  @Get(':id')
  get(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.classes.get(a, id);
  }

  @Can('read', 'class')
  @Get(':id/students')
  students(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.classes.students(a, id);
  }

  @Can('write', 'class')
  @Patch(':id/settings')
  settings(@Auth() a: AuthContext, @Param('id') id: string, @Body(new ZodPipe(classSettingsBody)) body: z.infer<typeof classSettingsBody>) {
    return this.classes.updateSettings(a, id, body);
  }

  @Can('write', 'class')
  @Post(':id/sync')
  sync(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.classes.sync(a, id);
  }

  @Can('read', 'class')
  @Get(':id/leaderboard')
  leaderboard(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.gamification.leaderboard(a, id);
  }
}
