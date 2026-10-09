import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  avatarColor,
  boardMsg,
  clampToMap,
  emoteMsg,
  joinRoomMsg,
  levelForXp,
  MAPS,
  moveMsg,
  pickSpawn,
  PlayerState,
  PRESENCE_GRACE_MS,
  reactionMsg,
  RoomSnapshot,
  signalMsg,
  speakingMsg,
  transcriptMsg,
} from '@tajriba/shared';
import type { Server, Socket } from 'socket.io';
import type { ZodType } from 'zod';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from './realtime.bus';
import { RoomAccessService, RoomGrant } from './room-access.service';
import { SessionLogService } from './session-log.service';
import { SocketAuthService, SocketIdentity } from './socket-auth.service';

interface SocketData {
  ident: SocketIdentity;
  /** client room name ("campus", "study:x") → grant */
  rooms: Map<string, RoomGrant>;
  /** last emote/reaction time (throttle) */
  lastFx?: number;
  /** last board flip time (throttles the event log) */
  lastBoard?: number;
}

type Ack = { ok: true; [k: string]: unknown } | { ok: false; error: string };

const LAST_SEEN_EVERY_MS = 30_000;
/** emotes and reactions closer together than this are dropped (spam guard) */
const FX_MIN_GAP_MS = 1_000;

/**
 * The Tajriba Campus realtime hub: presence, movement, emotes, WebRTC signaling and live exam transcripts.
 *
 * Lifecycle rule: sockets never end sessions. A disconnect only starts a grace period; sessions and exams end through
 * their own REST actions (End session, timer, abandon sweep).
 */
@WebSocketGateway({
  path: '/socket.io',
  // No trailing slash: Next.js redirects "/api/socket.io/" → "/api/socket.io", so the proxied path must match without it.
  addTrailingSlash: false,
  cors: { origin: config.WEB_URL, credentials: true },
  pingInterval: 20_000,
  pingTimeout: 20_000,
})
export class CampusGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger('Campus');
  /** overridable in tests */
  graceMs = PRESENCE_GRACE_MS;

  constructor(
    private readonly bus: RealtimeBus,
    private readonly auth: SocketAuthService,
    private readonly access: RoomAccessService,
    private readonly sessionLog: SessionLogService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.bus.attach(server);
    // Authenticate in middleware so no event is ever handled for an anonymous socket.
    server.use((socket, next) => {
      this.auth
        .identify(socket.handshake.headers.cookie)
        .then((ident) => {
          if (!ident) return next(new Error('unauthorized'));
          const data: SocketData = { ident, rooms: new Map() };
          socket.data = data;
          void socket.join(`user:${ident.userId}`);
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketData | undefined;
    if (!data?.ident) return;
    for (const grant of data.rooms.values()) this.detach(client, grant, 'disconnect');
    data.rooms.clear();
  }

  // ---------- rooms ----------

  @SubscribeMessage('room:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const msg = this.parse(joinRoomMsg, body);
    if (!msg) return { ok: false, error: 'bad_request' };
    const data = client.data as SocketData;
    const grant = await this.access.grant(data.ident, msg.room, msg.spectate ?? false);
    if (!grant) return { ok: false, error: 'forbidden' };

    // Leave other rooms of the same kind first (walking from the courtyard into a study room keeps both, that's fine).
    const previous = data.rooms.get(msg.room);
    if (previous && previous.key !== grant.key) this.detach(client, previous, 'leave');

    const map = MAPS[grant.map];
    const others = this.bus.presence.players(grant.key).filter((p) => p.userId !== data.ident.userId && !p.spectator);
    const spawn = pickSpawn(map, grant.spawnIndex, others);
    const initial: PlayerState = {
      userId: data.ident.userId,
      name: firstName(data.ident.name),
      role: data.ident.role,
      color: avatarColor(data.ident.userId),
      x: spawn.x,
      y: spawn.y,
      dir: 'down',
      moving: false,
      spectator: grant.spectator,
      ...(data.ident.role === 'STUDENT' ? { level: await this.levelOf(data.ident.userId) } : {}),
    };
    const { isNew, state } = this.bus.presence.join(grant.key, initial, client.id);
    data.rooms.set(msg.room, grant);
    await client.join(grant.key);

    if (isNew) client.to(grant.key).emit('player:joined', { room: msg.room, player: state });
    this.syncTogether(grant);
    if (grant.refId) {
      const type = grant.spectator ? 'SPECTATOR_JOINED' : isNew ? 'JOIN' : 'REJOIN';
      void this.sessionLog.log(grant.kind === 'study' ? 'STUDY' : 'EXAM', grant.refId, data.ident.userId, type);
      void this.touch(grant, data.ident.userId, true);
    }
    const snapshot: RoomSnapshot = {
      room: msg.room,
      map: grant.map,
      self: state,
      players: this.bus.presence.players(grant.key).filter((p) => p.userId !== data.ident.userId),
    };
    return { ok: true, snapshot, publishes: grant.publishes, ...(grant.kind === 'study' ? { boardIndex: this.bus.boards.get(grant.key) ?? 0 } : {}) };
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Ack {
    const msg = this.parse(joinRoomMsg, body);
    const data = client.data as SocketData;
    const grant = msg && data.rooms.get(msg.room);
    if (!grant) return { ok: false, error: 'not_in_room' };
    data.rooms.delete(msg.room);
    this.detach(client, grant, 'leave');
    return { ok: true };
  }

  // ---------- in-room actions ----------

  @SubscribeMessage('move')
  move(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(moveMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || ctx.state.spectator) return;
    const pos = clampToMap(MAPS[ctx.grant.map], msg.x, msg.y);
    Object.assign(ctx.state, pos, { dir: msg.dir ?? ctx.state.dir, moving: msg.moving ?? false });
    client.to(ctx.grant.key).volatile.emit('player:moved', { room: msg.room, userId: ctx.state.userId, ...pos, dir: ctx.state.dir, moving: ctx.state.moving });
    if (ctx.grant.refId && this.bus.presence.shouldWriteLastSeen(ctx.grant.key, ctx.state.userId, LAST_SEEN_EVERY_MS)) {
      void this.touch(ctx.grant, ctx.state.userId, false);
    }
  }

  @SubscribeMessage('emote')
  emote(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(emoteMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || ctx.state.spectator || this.throttled(client)) return;
    client.to(ctx.grant.key).emit('player:emote', { room: msg.room, userId: ctx.state.userId, emote: msg.emote });
    if (ctx.grant.refId) void this.sessionLog.log(this.kind(ctx.grant), ctx.grant.refId, ctx.state.userId, 'EMOTE', { emote: msg.emote });
  }

  @SubscribeMessage('reaction')
  reaction(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(reactionMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || ctx.state.spectator || this.throttled(client)) return;
    client.to(ctx.grant.key).emit('player:reaction', { room: msg.room, userId: ctx.state.userId, emoji: msg.emoji });
    if (ctx.grant.refId) void this.sessionLog.log(this.kind(ctx.grant), ctx.grant.refId, ctx.state.userId, 'REACTION', { emoji: msg.emoji });
  }

  @SubscribeMessage('speaking')
  speaking(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(speakingMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx) return;
    ctx.state.speaking = msg.speaking;
    client.to(ctx.grant.key).volatile.emit('player:speaking', { room: msg.room, userId: ctx.state.userId, speaking: msg.speaking });
  }

  /** WebRTC offer/answer/ICE relay — only between users present in the same room. */
  @SubscribeMessage('voice:signal')
  signal(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(signalMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || !this.bus.presence.has(ctx.grant.key, msg.to)) return;
    for (const sid of this.bus.presence.socketsOf(ctx.grant.key, msg.to)) {
      client.to(sid).emit('voice:signal', { room: msg.room, from: ctx.state.userId, signal: msg.signal });
    }
  }

  /** Study room: a partner flipped the discussion card on the Ideas board — both see the same card. */
  @SubscribeMessage('board')
  board(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(boardMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || ctx.grant.kind !== 'study' || ctx.state.spectator) return;
    this.bus.boards.set(ctx.grant.key, msg.index);
    client.to(ctx.grant.key).emit('board:card', { room: msg.room, index: msg.index });
    const data = client.data as SocketData;
    const now = Date.now();
    if (ctx.grant.refId && (!data.lastBoard || now - data.lastBoard >= FX_MIN_GAP_MS)) {
      data.lastBoard = now;
      void this.sessionLog.log('STUDY', ctx.grant.refId, ctx.state.userId, 'CARD', { index: msg.index });
    }
  }

  /** The student's live speech-to-text, shown to spectating teachers. */
  @SubscribeMessage('exam:transcript')
  transcript(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const msg = this.parse(transcriptMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || ctx.grant.kind !== 'exam' || ctx.state.spectator) return;
    client.to(ctx.grant.key).volatile.emit('exam:transcript', { room: msg.room, text: msg.text });
  }

  // ---------- helpers ----------

  /** true = drop this emote/reaction (one per FX_MIN_GAP_MS per socket). */
  private throttled(client: Socket): boolean {
    const data = client.data as SocketData;
    const now = Date.now();
    if (data.lastFx && now - data.lastFx < FX_MIN_GAP_MS) return true;
    data.lastFx = now;
    return false;
  }

  private inRoom(client: Socket, room: string): { grant: RoomGrant; state: PlayerState } | null {
    const data = client.data as SocketData;
    const grant = data?.rooms.get(room);
    if (!grant) return null;
    const state = this.bus.presence.get(grant.key, data.ident.userId);
    return state ? { grant, state } : null;
  }

  /** One socket leaves a room. The user disappears for others only when no socket is left and the grace period passed. */
  private detach(client: Socket, grant: RoomGrant, why: 'leave' | 'disconnect') {
    const data = client.data as SocketData;
    const userId = data.ident.userId;
    void client.leave(grant.key);
    const last = this.bus.presence.leaveSocket(grant.key, userId, client.id);
    // together time stops as soon as a partner has no live socket (no grace period for XP)
    this.syncTogether(grant);
    if (!last) return;
    const gone = () => {
      this.bus.toRoom(grant.key, 'player:left', { room: roomName(grant), userId });
      if (grant.refId) {
        void this.sessionLog.log(this.kind(grant), grant.refId, userId, grant.spectator ? 'SPECTATOR_LEFT' : 'LEAVE', { why });
        void this.touch(grant, userId, false, true);
      }
    };
    // Intentional leave (clicked "Leave room") is immediate; a dropped connection waits for a reconnect.
    if (why === 'leave') {
      this.bus.presence.remove(grant.key, userId);
      gone();
    } else {
      this.bus.presence.scheduleRemoval(grant.key, userId, this.graceMs, gone);
    }
  }

  /** Overall level shown on the avatar (0 when the lookup fails — the badge is just hidden). */
  private async levelOf(userId: string): Promise<number> {
    try {
      const r = await this.prisma.xpEvent.aggregate({ where: { studentId: userId }, _sum: { amount: true } });
      return levelForXp(r._sum.amount ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Study rooms: starts or stops the "together" clock when both partners are (or stop being) connected, stores the
   * ended segment and tells the room, so both see the same together time.
   */
  private syncTogether(grant: RoomGrant) {
    if (grant.kind !== 'study' || !grant.refId) return;
    const together = this.bus.presence.connected(grant.key).filter((p) => !p.spectator).length >= 2;
    const wasTogether = this.bus.together.sinceOf(grant.key) !== null;
    if (wasTogether === together) return;
    const endedMs = this.bus.together.update(grant.key, together);
    const sessionId = grant.refId;
    // tracked: ending the session waits for this write, so a segment that just ended still counts for XP
    const write = (async () => {
      try {
        const s = endedMs
          ? await this.prisma.studySession.update({ where: { id: sessionId }, data: { togetherMs: { increment: endedMs } }, select: { togetherMs: true } })
          : await this.prisma.studySession.findUnique({ where: { id: sessionId }, select: { togetherMs: true } });
        const since = this.bus.together.sinceOf(grant.key);
        this.bus.toRoom(grant.key, 'study:together', { sessionId, togetherMs: s?.togetherMs ?? 0, since: since ? new Date(since).toISOString() : null });
      } catch (e) {
        this.logger.warn(`together time update failed: ${e instanceof Error ? e.message : e}`);
      }
    })();
    this.bus.together.track(grant.key, write);
  }

  private kind(grant: RoomGrant): 'STUDY' | 'EXAM' {
    return grant.kind === 'study' ? 'STUDY' : 'EXAM';
  }

  /** "Last seen" bookkeeping used by the abandon sweeper. Never throws. */
  private async touch(grant: RoomGrant, userId: string, joined: boolean, left = false) {
    const now = new Date();
    try {
      if (grant.kind === 'study' && grant.refId) {
        await this.prisma.studySessionParticipant.updateMany({
          where: { sessionId: grant.refId, userId },
          data: { lastSeen: now, ...(joined ? { leftAt: null } : {}), ...(left ? { leftAt: now } : {}) },
        });
        if (joined) {
          await this.prisma.studySessionParticipant.updateMany({ where: { sessionId: grant.refId, userId, joinedAt: null }, data: { joinedAt: now } });
        }
      } else if (grant.kind === 'exam' && grant.refId && !grant.spectator) {
        await this.prisma.examAttempt.updateMany({ where: { id: grant.refId, studentId: userId }, data: { lastSeen: now } });
      }
    } catch (e) {
      this.logger.warn(`lastSeen update failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  private parse<T>(schema: ZodType<T>, body: unknown): T | null {
    const r = schema.safeParse(body);
    return r.success ? r.data : null;
  }
}

/** "Ms. Rana Khoury" → "Ms. Rana", "Lea" → "Lea". */
function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const short = parts[0]?.endsWith('.') && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
  return short?.slice(0, 24) || 'Friend';
}

function roomName(grant: RoomGrant): string {
  return grant.kind === 'campus' ? 'campus' : `${grant.kind}:${grant.refId}`;
}
