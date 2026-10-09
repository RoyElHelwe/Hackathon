import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { PresenceRegistry } from './presence';

/**
 * Lets services push realtime events without depending on the gateway (no circular imports).
 * Every socket joins `user:<id>`; room keys are `campus:<schoolId>`, `study:<sessionId>`, `exam:<attemptId>`.
 */
@Injectable()
export class RealtimeBus {
  private server: Server | null = null;
  readonly presence = new PresenceRegistry();

  attach(server: Server) {
    this.server = server;
  }

  toRoom(room: string, event: string, data: unknown) {
    this.server?.to(room).emit(event, data);
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  isOnline(userId: string): boolean {
    return (this.server?.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) > 0;
  }

  /** Teachers currently watching an exam room. */
  spectators(room: string): string[] {
    return this.presence.connected(room).filter((p) => p.spectator).map((p) => p.userId);
  }
}
