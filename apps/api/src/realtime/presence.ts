import type { PlayerState } from '@tajriba/shared';

interface Entry {
  state: PlayerState;
  sockets: Set<string>;
  leaveTimer?: ReturnType<typeof setTimeout>;
  lastSeenWrite: number;
}

/**
 * Who is in which room, tracked PER SOCKET. A user is only "gone" when their LAST socket in the room has left and the
 * grace period expired. That is what keeps a session alive through reloads, second tabs and network blips — a stale
 * disconnect from an old socket can never evict a user who already reconnected on a new one.
 */
export class PresenceRegistry {
  private readonly rooms = new Map<string, Map<string, Entry>>();

  /** Adds a socket. Returns whether the user is new in the room (others should be told). */
  join(room: string, state: PlayerState, socketId: string): { isNew: boolean; state: PlayerState } {
    let members = this.rooms.get(room);
    if (!members) {
      members = new Map();
      this.rooms.set(room, members);
    }
    const existing = members.get(state.userId);
    if (existing) {
      existing.sockets.add(socketId);
      if (existing.leaveTimer) clearTimeout(existing.leaveTimer);
      existing.leaveTimer = undefined;
      // a spectator who opens the room as a player (or back) takes the latest mode
      existing.state.spectator = state.spectator;
      return { isNew: false, state: existing.state };
    }
    members.set(state.userId, { state, sockets: new Set([socketId]), lastSeenWrite: 0 });
    return { isNew: true, state };
  }

  /** Removes one socket. Returns true when that was the user's last socket in the room. */
  leaveSocket(room: string, userId: string, socketId: string): boolean {
    const e = this.rooms.get(room)?.get(userId);
    if (!e) return false;
    e.sockets.delete(socketId);
    return e.sockets.size === 0;
  }

  /** Schedules removal after the grace period; cancelled if the user rejoins. `onGone` runs only if still absent. */
  scheduleRemoval(room: string, userId: string, graceMs: number, onGone: () => void) {
    const e = this.rooms.get(room)?.get(userId);
    if (!e || e.sockets.size) return;
    if (e.leaveTimer) clearTimeout(e.leaveTimer);
    e.leaveTimer = setTimeout(() => {
      const cur = this.rooms.get(room)?.get(userId);
      if (cur && cur.sockets.size === 0) {
        this.remove(room, userId);
        onGone();
      }
    }, graceMs);
    e.leaveTimer.unref?.();
  }

  /** Immediate removal (explicit leave with no other socket). */
  remove(room: string, userId: string) {
    const members = this.rooms.get(room);
    const e = members?.get(userId);
    if (e?.leaveTimer) clearTimeout(e.leaveTimer);
    members?.delete(userId);
    if (members && members.size === 0) this.rooms.delete(room);
  }

  get(room: string, userId: string): PlayerState | undefined {
    return this.rooms.get(room)?.get(userId)?.state;
  }

  socketsOf(room: string, userId: string): string[] {
    return [...(this.rooms.get(room)?.get(userId)?.sockets ?? [])];
  }

  /** Players in the room, including those inside their grace period. */
  players(room: string): PlayerState[] {
    return [...(this.rooms.get(room)?.values() ?? [])].map((e) => e.state);
  }

  /** Only users with at least one live socket. */
  connected(room: string): PlayerState[] {
    return [...(this.rooms.get(room)?.values() ?? [])].filter((e) => e.sockets.size > 0).map((e) => e.state);
  }

  has(room: string, userId: string): boolean {
    return !!this.rooms.get(room)?.has(userId);
  }

  /** True at most once per `everyMs` per user+room (throttles DB "last seen" writes). */
  shouldWriteLastSeen(room: string, userId: string, everyMs: number, now = Date.now()): boolean {
    const e = this.rooms.get(room)?.get(userId);
    if (!e) return false;
    if (now - e.lastSeenWrite < everyMs) return false;
    e.lastSeenWrite = now;
    return true;
  }

  clear() {
    for (const members of this.rooms.values()) for (const e of members.values()) if (e.leaveTimer) clearTimeout(e.leaveTimer);
    this.rooms.clear();
  }
}
