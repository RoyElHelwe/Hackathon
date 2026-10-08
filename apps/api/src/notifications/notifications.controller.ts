import { Controller, Get, Param, Post } from '@nestjs/common';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Can('read', 'self')
  @Get()
  list(@Auth() a: AuthContext) {
    return this.notifications.list(a.userId);
  }

  @Can('write', 'self')
  @Post('read-all')
  readAll(@Auth() a: AuthContext) {
    return this.notifications.markAllRead(a.userId);
  }

  @Can('write', 'self')
  @Post(':id/read')
  read(@Auth() a: AuthContext, @Param('id') id: string) {
    return this.notifications.markRead(a.userId, id);
  }
}
