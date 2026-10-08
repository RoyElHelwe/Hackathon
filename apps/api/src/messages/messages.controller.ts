import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { messageBody } from '@tajriba/shared';
import { AuthContext } from '../common/auth-context';
import { Auth, Can } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Can('read', 'message')
  @Get('contacts')
  contacts(@Auth() a: AuthContext) {
    return this.messages.contacts(a);
  }

  @Can('read', 'message')
  @Get()
  thread(@Auth() a: AuthContext, @Query('with') withId: string) {
    return this.messages.thread(a, withId);
  }

  @Can('write', 'message')
  @Post()
  send(@Auth() a: AuthContext, @Body(new ZodPipe(messageBody)) body: { toId: string; studentId?: string; body: string }) {
    return this.messages.send(a, body);
  }
}
