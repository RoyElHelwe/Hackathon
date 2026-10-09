import { Controller, Get } from '@nestjs/common';
import { Can } from '../common/decorators';
import { config } from '../config';

@Controller('realtime')
export class RealtimeController {
  /** ICE servers for WebRTC voice: public STUN, plus TURN when configured. */
  @Can('read', 'self')
  @Get('ice')
  ice() {
    const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];
    const turn = config.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean);
    if (turn.length) iceServers.push({ urls: turn, username: config.TURN_USERNAME, credential: config.TURN_CREDENTIAL });
    return { iceServers };
  }
}
