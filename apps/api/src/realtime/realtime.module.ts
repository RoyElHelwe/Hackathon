import { Global, Module } from '@nestjs/common';
import { CampusGateway } from './campus.gateway';
import { RealtimeBus } from './realtime.bus';
import { RealtimeController } from './realtime.controller';
import { RoomAccessService } from './room-access.service';
import { SessionLogService } from './session-log.service';
import { SocketAuthService } from './socket-auth.service';

/** Socket.IO campus hub + helpers other modules use to broadcast and log session actions. */
@Global()
@Module({
  controllers: [RealtimeController],
  providers: [CampusGateway, RealtimeBus, SocketAuthService, RoomAccessService, SessionLogService],
  exports: [RealtimeBus, SessionLogService],
})
export class RealtimeModule {}
