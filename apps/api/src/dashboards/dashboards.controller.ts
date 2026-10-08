import { Controller, Get, Param, Post } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Can('read', 'class')
  @Get('teacher/:classId')
  teacher(@Auth() a: AuthContext, @Param('classId') classId: string) {
    return this.dashboards.teacher(a, classId);
  }

  @Can('write', 'class')
  @Post('teacher/:classId/group-sessions')
  groupSessions(@Auth() a: AuthContext, @Param('classId') classId: string) {
    return this.dashboards.groupSessions(a, classId);
  }

  @Can('read', 'members')
  @Get('director/:schoolId')
  director(@Auth() a: AuthContext, @Param('schoolId') schoolId: string) {
    return this.dashboards.director(a, schoolId);
  }

  @Can('read', 'progress')
  @Get('parent/:studentId')
  parent(@Auth() a: AuthContext, @Param('studentId') studentId: string) {
    return this.dashboards.parent(a, studentId);
  }
}
