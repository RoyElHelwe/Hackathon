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
  clampToMap,
  emoteMsg,
  joinRoomMsg,
  listenMsg,
  moveMsg,
  PlayerState,
  PRESENCE_GRACE_MS,
  reactionMsg,
  RoomSnapshot,
  signalMsg,
  spawnFor,
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

    const spawn = spawnFor(grant.mapDef, grant.spawnIndex);
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
    };
    const { isNew, state } = this.bus.presence.join(grant.key, initial, client.id);
    data.rooms.set(msg.room, grant);
    await client.join(grant.key);

    if (isNew) client.to(grant.key).emit('player:joined', { room: msg.room, player: state });
    if (grant.refId && (grant.kind === 'study' || grant.kind === 'exam')) {
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
    return { ok: true, snapshot, publishes: grant.publishes };
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
    const pos = clampToMap(ctx.grant.mapDef, msg.x, msg.y);
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

  /**
   * A spectating teacher starts/stops hearing an exam room (walking into / out of it in the Exam Hall, or "Listen").
   * The student's browser only sends its microphone to spectators that are listening, and sees who is.
   */
  @SubscribeMessage('spectate:listen')
  listen(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Ack {
    const msg = this.parse(listenMsg, body);
    const ctx = msg && this.inRoom(client, msg.room);
    if (!msg || !ctx || ctx.grant.kind !== 'exam' || !ctx.state.spectator) return { ok: false, error: 'forbidden' };
    if (!!ctx.state.listening !== msg.on) {
      ctx.state.listening = msg.on;
      client.to(ctx.grant.key).emit('player:listening', { room: msg.room, userId: ctx.state.userId, listening: msg.on });
      if (ctx.grant.refId) void this.sessionLog.log('EXAM', ctx.grant.refId, ctx.state.userId, 'SPECTATOR_LISTENING', { on: msg.on });
    }
    return { ok: true };
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
    if (!last) return;
    const gone = () => {
      this.bus.toRoom(grant.key, 'player:left', { room: grant.name, userId });
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

  /** Only study and exam rooms have a refId (hall and courtyard are not logged). */
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
