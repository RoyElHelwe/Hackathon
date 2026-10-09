import { z } from 'zod';

// ---------- 2D campus maps (pixels; the web renders them with Phaser, the API validates positions) ----------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FurnitureKind =
  | 'desk'
  | 'table'
  | 'sofa'
  | 'plant'
  | 'board'
  | 'rug'
  | 'shelf'
  | 'lamp'
  | 'arzino'
  | 'tree'
  | 'fountain'
  | 'bench';

export interface Furniture extends Rect {
  kind: FurnitureKind;
  solid?: boolean;
  label?: string;
}

export type ZoneKind = 'lobby' | 'study_door' | 'exam_door' | 'garden' | 'stage' | 'study_room' | 'exam_desk' | 'hall_room';

export interface Zone extends Rect {
  id: string;
  kind: ZoneKind;
  label: string;
}

export type CampusMapId = 'campus' | 'study' | 'exam' | 'hall';

/** Purely visual ground details (no collisions, ignored by the API). */
export type DecorKind = 'building' | 'path' | 'plaza' | 'flowers' | 'flag' | 'window';

export interface Decor extends Rect {
  kind: DecorKind;
  /** building floor: wood | tile */
  floor?: 'wood' | 'tile';
}

export interface CampusMap {
  id: CampusMapId;
  width: number;
  height: number;
  /** floor style token: mint = grass courtyard · sunny = warm wood · sky = light tiles (violet | coral = stone) */
  floor: string;
  walls: Rect[];
  furniture: Furniture[];
  zones: Zone[];
  spawns: { x: number; y: number }[];
  /** optional ground art drawn under everything (paths, building floors, flowers, flags, windows) */
  decor?: Decor[];
}

const W = 16; // wall thickness

function border(width: number, height: number): Rect[] {
  return [
    { x: 0, y: 0, w: width, h: W },
    { x: 0, y: height - W, w: width, h: W },
    { x: 0, y: 0, w: W, h: height },
    { x: width - W, y: 0, w: W, h: height },
  ];
}

/** The shared school courtyard: everyone online in the school walks here. Doors lead to private rooms. */
export const CAMPUS_MAP: CampusMap = {
  id: 'campus',
  width: 1600,
  height: 1000,
  floor: 'mint',
  walls: [
    ...border(1600, 1000),
    // Study Hall building (left)
    { x: 80, y: 80, w: 440, h: W },
    { x: 80, y: 80, w: W, h: 360 },
    { x: 504, y: 80, w: W, h: 140 },
    { x: 504, y: 300, w: W, h: 140 },
    { x: 80, y: 424, w: 440, h: W },
    // Exam Wing building (right)
    { x: 1080, y: 80, w: 440, h: W },
    { x: 1504, y: 80, w: W, h: 360 },
    { x: 1080, y: 80, w: W, h: 140 },
    { x: 1080, y: 300, w: W, h: 140 },
    { x: 1080, y: 424, w: 440, h: W },
  ],
  furniture: [
    { kind: 'rug', x: 120, y: 120, w: 360, h: 280, label: 'Study Hall' },
    { kind: 'table', x: 170, y: 180, w: 100, h: 60, solid: true },
    { kind: 'table', x: 330, y: 180, w: 100, h: 60, solid: true },
    { kind: 'sofa', x: 170, y: 310, w: 120, h: 44, solid: true },
    { kind: 'shelf', x: 330, y: 310, w: 120, h: 40, solid: true },
    { kind: 'rug', x: 1120, y: 120, w: 360, h: 280, label: 'Exam Wing' },
    { kind: 'desk', x: 1180, y: 170, w: 70, h: 50, solid: true },
    { kind: 'desk', x: 1340, y: 170, w: 70, h: 50, solid: true },
    { kind: 'desk', x: 1180, y: 300, w: 70, h: 50, solid: true },
    { kind: 'desk', x: 1340, y: 300, w: 70, h: 50, solid: true },
    { kind: 'fountain', x: 740, y: 560, w: 120, h: 120, solid: true },
    { kind: 'tree', x: 160, y: 620, w: 70, h: 70, solid: true },
    { kind: 'tree', x: 380, y: 820, w: 70, h: 70, solid: true },
    { kind: 'tree', x: 1370, y: 620, w: 70, h: 70, solid: true },
    { kind: 'tree', x: 1150, y: 830, w: 70, h: 70, solid: true },
    { kind: 'tree', x: 470, y: 600, w: 70, h: 70, solid: true },
    { kind: 'tree', x: 1060, y: 600, w: 70, h: 70, solid: true },
    { kind: 'bench', x: 600, y: 820, w: 110, h: 36, solid: true },
    { kind: 'bench', x: 890, y: 820, w: 110, h: 36, solid: true },
    { kind: 'plant', x: 560, y: 120, w: 40, h: 40, solid: true },
    { kind: 'plant', x: 1000, y: 120, w: 40, h: 40, solid: true },
    { kind: 'board', x: 680, y: 60, w: 240, h: 60, solid: true, label: 'Tajriba Campus' },
    { kind: 'arzino', x: 770, y: 180, w: 60, h: 60, solid: true },
  ],
  zones: [
    { id: 'lobby', kind: 'lobby', x: 540, y: 140, w: 520, h: 400, label: 'Courtyard' },
    { id: 'study-door', kind: 'study_door', x: 520, y: 220, w: 70, h: 80, label: 'Study Hall' },
    { id: 'exam-door', kind: 'exam_door', x: 1010, y: 220, w: 70, h: 80, label: 'Exam Wing' },
    { id: 'garden', kind: 'garden', x: 100, y: 520, w: 1400, h: 420, label: 'Garden' },
  ],
  spawns: [
    { x: 800, y: 420 },
    { x: 740, y: 460 },
    { x: 860, y: 460 },
    { x: 700, y: 380 },
    { x: 900, y: 380 },
  ],
  decor: [
    { kind: 'flowers', x: 110, y: 500, w: 360, h: 220 },
    { kind: 'flowers', x: 1130, y: 500, w: 360, h: 220 },
    { kind: 'flowers', x: 110, y: 820, w: 250, h: 150 },
    { kind: 'flowers', x: 1240, y: 820, w: 250, h: 150 },
    { kind: 'path', x: 740, y: 700, w: 120, h: 280 },
    { kind: 'path', x: 100, y: 740, w: 1400, h: 56 },
    { kind: 'plaza', x: 560, y: 110, w: 480, h: 610 },
    { kind: 'path', x: 500, y: 222, w: 80, h: 76 },
    { kind: 'path', x: 1020, y: 222, w: 80, h: 76 },
    { kind: 'building', x: 80, y: 80, w: 440, h: 360, floor: 'wood' },
    { kind: 'building', x: 1080, y: 80, w: 440, h: 360, floor: 'tile' },
    { kind: 'flag', x: 628, y: 40, w: 40, h: 80 },
    { kind: 'flag', x: 934, y: 40, w: 40, h: 80 },
  ],
};

/** A cozy private room for two classmates. */
export const STUDY_ROOM_MAP: CampusMap = {
  id: 'study',
  width: 800,
  height: 560,
  floor: 'sunny',
  walls: border(800, 560),
  furniture: [
    { kind: 'rug', x: 220, y: 170, w: 360, h: 230 },
    { kind: 'table', x: 330, y: 240, w: 140, h: 80, solid: true, label: 'Discussion table' },
    { kind: 'board', x: 260, y: 30, w: 280, h: 70, solid: true, label: 'Ideas board' },
    { kind: 'sofa', x: 40, y: 220, w: 50, h: 140, solid: true },
    { kind: 'shelf', x: 640, y: 40, w: 120, h: 40, solid: true },
    { kind: 'plant', x: 40, y: 40, w: 40, h: 40, solid: true },
    { kind: 'plant', x: 720, y: 480, w: 40, h: 40, solid: true },
    { kind: 'lamp', x: 40, y: 480, w: 36, h: 36, solid: true },
    { kind: 'arzino', x: 690, y: 240, w: 60, h: 60, solid: true },
  ],
  zones: [
    { id: 'table', kind: 'study_room', x: 280, y: 200, w: 240, h: 160, label: 'Table' },
    { id: 'board', kind: 'stage', x: 240, y: 100, w: 320, h: 70, label: 'Board' },
  ],
  spawns: [
    { x: 300, y: 440 },
    { x: 500, y: 440 },
  ],
  decor: [
    { kind: 'window', x: 100, y: 0, w: 120, h: 16 },
    { kind: 'window', x: 580, y: 0, w: 40, h: 16 },
    { kind: 'window', x: 240, y: 544, w: 120, h: 16 },
    { kind: 'window', x: 440, y: 544, w: 120, h: 16 },
  ],
};

/** A quiet private room: the student and Arzino, the AI interviewer. */
export const EXAM_ROOM_MAP: CampusMap = {
  id: 'exam',
  width: 720,
  height: 520,
  floor: 'sky',
  walls: border(720, 520),
  furniture: [
    { kind: 'rug', x: 200, y: 150, w: 320, h: 220 },
    { kind: 'desk', x: 300, y: 210, w: 120, h: 70, solid: true, label: 'Interview desk' },
    { kind: 'arzino', x: 330, y: 130, w: 60, h: 60, solid: true },
    { kind: 'plant', x: 40, y: 40, w: 40, h: 40, solid: true },
    { kind: 'plant', x: 640, y: 40, w: 40, h: 40, solid: true },
    { kind: 'shelf', x: 40, y: 440, w: 120, h: 40, solid: true },
    { kind: 'lamp', x: 640, y: 440, w: 36, h: 36, solid: true },
  ],
  zones: [{ id: 'desk', kind: 'exam_desk', x: 260, y: 280, w: 200, h: 90, label: 'Your seat' }],
  spawns: [{ x: 360, y: 330 }],
  decor: [
    { kind: 'window', x: 140, y: 0, w: 140, h: 16 },
    { kind: 'window', x: 440, y: 0, w: 140, h: 16 },
  ],
};

export const MAPS = { campus: CAMPUS_MAP, study: STUDY_ROOM_MAP, exam: EXAM_ROOM_MAP } as const;

// ---------- Exam Hall: one glass room per student, built from the exam's room numbers ----------

export const HALL_ROOM = { w: 260, h: 190, door: 80, corridor: 110, margin: 64, maxCols: 6 } as const;

/** One student's room in the hall: its zone (the interior), where the student and Arzino sit, and its door. */
export interface HallRoom {
  roomIndex: number;
  zone: Zone;
  seat: { x: number; y: number };
  arzino: { x: number; y: number };
  /** just inside the door: where a teacher lands when jumping to the room */
  entry: { x: number; y: number };
}

function hallCols(n: number): number {
  return Math.max(1, Math.min(HALL_ROOM.maxCols, n, Math.ceil(Math.sqrt(n * 1.5))));
}

/** Rooms of the hall, in room-number order. Rows of rooms, each row below its own corridor (doors face up). */
export function hallRooms(roomIndexes: number[]): HallRoom[] {
  const sorted = [...new Set(roomIndexes)].sort((a, b) => a - b);
  const cols = hallCols(sorted.length);
  const { w, h, corridor, margin } = HALL_ROOM;
  return sorted.map((roomIndex, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * w;
    const y = margin + corridor + row * (h + corridor);
    const cx = x + w / 2;
    return {
      roomIndex,
      zone: { id: `room-${roomIndex}`, kind: 'hall_room', x: x + 8, y: y + 8, w: w - 16, h: h - 16, label: `#${roomIndex}` },
      seat: { x: cx - 50, y: y + h - 52 },
      arzino: { x: cx + 50, y: y + h - 58 },
      entry: { x: cx, y: y + 40 },
    };
  });
}

/** The whole hall map (the API uses it to keep positions inside, the web draws it). */
export function examHallMap(roomIndexes: number[]): CampusMap {
  const rooms = hallRooms(roomIndexes);
  const n = Math.max(1, rooms.length);
  const cols = hallCols(n);
  const rows = Math.ceil(n / cols);
  const { w, h, door, corridor, margin } = HALL_ROOM;
  const width = margin * 2 + cols * w;
  const height = margin * 2 + rows * (h + corridor) + corridor / 2;
  const t = 8; // glass wall thickness
  const walls: Rect[] = [...border(width, height)];
  const furniture: Furniture[] = [];
  for (const r of rooms) {
    const x = r.zone.x - 8;
    const y = r.zone.y - 8;
    const side = (w - door) / 2;
    walls.push(
      { x, y, w: side, h: t },
      { x: x + side + door, y, w: side, h: t },
      { x, y, w: t, h },
      { x: x + w - t, y, w: t, h },
      { x, y: y + h - t, w, h: t },
    );
    furniture.push(
      { kind: 'rug', x: x + 20, y: y + 50, w: w - 40, h: h - 70 },
      { kind: 'desk', x: x + w / 2 - 40, y: y + h - 110, w: 80, h: 40, solid: true },
      { kind: 'arzino', x: r.arzino.x - 20, y: r.arzino.y - 20, w: 40, h: 40, solid: true },
    );
  }
  return {
    id: 'hall',
    width,
    height,
    floor: 'sky',
    walls,
    furniture,
    zones: rooms.map((r) => r.zone),
    spawns: [
      { x: width / 2, y: margin + corridor / 2 },
      { x: width / 2 - 50, y: margin + corridor / 2 },
      { x: width / 2 + 50, y: margin + corridor / 2 },
    ],
  };
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** The first zone containing the point (doors win over the lobby because they are listed after it). */
export function zoneAt(map: CampusMap, x: number, y: number): Zone | null {
  let found: Zone | null = null;
  for (const z of map.zones) if (inRect(z, x, y)) found = z;
  return found;
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Keeps a position inside the walkable area of a map. */
export function clampToMap(map: CampusMap, x: number, y: number): { x: number; y: number } {
  const pad = W + 14;
  const cx = Number.isFinite(x) ? x : map.spawns[0].x;
  const cy = Number.isFinite(y) ? y : map.spawns[0].y;
  return {
    x: Math.round(Math.min(map.width - pad, Math.max(pad, cx))),
    y: Math.round(Math.min(map.height - pad, Math.max(pad, cy))),
  };
}

export function spawnFor(map: CampusMap, index: number): { x: number; y: number } {
  return map.spawns[Math.abs(index) % map.spawns.length];
}

/**
 * Voice volume by distance (proximity audio in the study room): full volume up to `near`,
 * fading linearly to `min` at `far`.
 */
export function voiceGain(dist: number, near = 120, far = 520, min = 0.25): number {
  if (dist <= near) return 1;
  if (dist >= far) return min;
  return 1 - ((dist - near) / (far - near)) * (1 - min);
}

/** Stable avatar color per user (Arzino palette: cedar, Mediterranean blue, flag red, flame, leaf, gold, rose). */
export const AVATAR_COLORS = ['#00a651', '#1c8be0', '#e4252d', '#ff9600', '#22c58b', '#ffc21a', '#e86bb4'] as const;
export function avatarColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ---------- Realtime protocol (Socket.IO) ----------

export const EMOTES = ['wave', 'laugh', 'dance', 'mindblown', 'clap', 'think', 'sit', 'sad'] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_EMOJI: Record<Emote, string> = { wave: '👋', laugh: '😂', dance: '💃', mindblown: '🤯', clap: '👏', think: '🤔', sit: '🪑', sad: '😞' };
export const REACTIONS = ['❤️', '🔥', '⭐', '🎉', '💡', '👍', '😮', '🙌'] as const;

/** Rooms: the school courtyard, a study session room, an exam attempt room (students + teacher spectators), or an exam's hall (teachers). */
export type RoomRef = { kind: 'campus' } | { kind: 'study' | 'exam' | 'hall'; id: string };

export function roomKey(ref: RoomRef, schoolId?: string): string {
  if (ref.kind === 'campus') return `campus:${schoolId ?? ''}`;
  return `${ref.kind}:${ref.id}`;
}

export function parseRoom(room: string): RoomRef | null {
  if (room === 'campus') return { kind: 'campus' };
  const m = /^(study|exam|hall):([A-Za-z0-9_-]{1,64})$/.exec(room);
  if (!m) return null;
  return { kind: m[1] as 'study' | 'exam' | 'hall', id: m[2] };
}

export const roomName = z.string().min(1).max(80);
export const joinRoomMsg = z.object({ room: roomName, spectate: z.boolean().optional() });
export const moveMsg = z.object({
  room: roomName,
  x: z.number().finite(),
  y: z.number().finite(),
  dir: z.enum(['up', 'down', 'left', 'right']).optional(),
  moving: z.boolean().optional(),
});
export const emoteMsg = z.object({ room: roomName, emote: z.enum(EMOTES) });
export const reactionMsg = z.object({ room: roomName, emoji: z.enum(REACTIONS) });
export const speakingMsg = z.object({ room: roomName, speaking: z.boolean() });
export const signalMsg = z.object({
  room: roomName,
  to: z.string().min(1).max(64),
  // RTCSessionDescriptionInit or RTCIceCandidateInit (browser objects, relayed as-is)
  signal: z.object({ type: z.string().max(20).optional(), sdp: z.string().max(20_000).optional(), candidate: z.unknown().optional() }).passthrough(),
});
export const transcriptMsg = z.object({ room: roomName, text: z.string().max(2000) });
/** A spectator starts/stops listening to an exam room (the student's browser only sends audio while this is on). */
export const listenMsg = z.object({ room: roomName, on: z.boolean() });

export interface PlayerState {
  userId: string;
  name: string;
  role: string;
  color: string;
  x: number;
  y: number;
  dir: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
  spectator: boolean;
  speaking?: boolean;
  /** spectators only: currently hearing the room */
  listening?: boolean;
}

export interface RoomSnapshot {
  room: string;
  map: CampusMapId;
  self: PlayerState;
  players: PlayerState[];
}

/** Grace period before a disconnected player is shown as gone (a reconnect within it is invisible to others). */
export const PRESENCE_GRACE_MS = 15_000;
/** A study session with nobody in it for this long is ended by the sweeper. */
export const STUDY_ABANDON_MS = 3 * 60_000;
/** An invite that was not accepted in this time expires. */
export const STUDY_INVITE_TTL_MS = 10 * 60_000;
/** Minimum active time for a study session to earn XP. */
export const STUDY_MIN_XP_MS = 5 * 60_000;
export const STUDY_XP = 20;
/** study sessions that give XP per student per day (Asia/Beirut); more sessions are fine, just not rewarded */
export const STUDY_XP_DAILY_CAP = 3;
