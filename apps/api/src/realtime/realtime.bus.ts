import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { PresenceRegistry } from './presence';
import { TogetherClock } from './together';

/**
 * Lets services push realtime events without depending on the gateway (no circular imports).
 * Every socket joins `user:<id>`; room keys are `campus:<schoolId>`, `study:<sessionId>`, `exam:<attemptId>`.
 */
@Injectable()
export class RealtimeBus {
  private server: Server | null = null;
  readonly presence = new PresenceRegistry();
  /** how long study partners are in their room together (study XP) */
  readonly together = new TogetherClock();
  /** study rooms: index of the discussion card on the Ideas board (both partners see the same one) */
  readonly boards = new Map<string, number>();

  attach(server: Server) {
    this.server = server;
  }

  toRoom(room: string, event: string, data: unknown) {
    this.server?.to(room).emit(event, data);
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Drops every socket of a user so none keeps an old identity. `reconnect: true` closes only the transport, so the
   * client reconnects and re-authenticates with its current cookie (role switch); false ends them for good (logout).
   */
  disconnectUser(userId: string, reconnect: boolean) {
    const ids = this.server?.sockets.adapter.rooms.get(`user:${userId}`);
    for (const id of [...(ids ?? [])]) {
      const s = this.server?.sockets.sockets.get(id);
      if (!s) continue;
      if (reconnect) s.conn.close();
      else s.disconnect(true);
    }
  }

  isOnline(userId: string): boolean {
    return (this.server?.sockets.adapter.rooms.get(`user:${userId}`)?.size ?? 0) > 0;
  }

  /** Teachers currently watching an exam room. */
  spectators(room: string): string[] {
    return this.presence.connected(room).filter((p) => p.spectator).map((p) => p.userId);
  }
}
