import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ParentsService } from './parents.service';

@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Can('read', 'parent_summary')
  @Get('summary/:studentId')
  summary(@Auth() a: AuthContext, @Param('studentId') studentId: string, @Query('week') week?: string, @Query('lang') lang?: string) {
    return this.parents.summary(a, studentId, week, { lang });
  }

  @Can('write', 'parent_summary')
  @Post('summary/:studentId/generate')
  generate(@Auth() a: AuthContext, @Param('studentId') studentId: string, @Query('week') week?: string, @Query('lang') lang?: string) {
    return this.parents.summary(a, studentId, week, { regenerate: true, lang });
  }
}
