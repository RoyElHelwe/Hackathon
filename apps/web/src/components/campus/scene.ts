import { avatarColor, type CampusMap, type Decor, type Furniture, type PlayerState, type Rect, type Zone } from '@tajriba/shared';

type PhaserNS = typeof import('phaser');
type Container = import('phaser').GameObjects.Container;
type Graphics = import('phaser').GameObjects.Graphics;
type Text = import('phaser').GameObjects.Text;
type Arc = import('phaser').GameObjects.Arc;
type Dir = PlayerState['dir'];

export interface SceneApi {
  setSelf(p: PlayerState | null): void;
  upsert(p: PlayerState): void;
  move(userId: string, x: number, y: number, dir: Dir, moving: boolean): void;
  remove(userId: string): void;
  clearOthers(): void;
  emote(userId: string, emoji: string): void;
  speaking(userId: string, on: boolean): void;
  positions(): Map<string, { x: number; y: number }>;
  selfPos(): { x: number; y: number } | null;
  /** jump my avatar somewhere (Exam Hall room switching) */
  teleport(x: number, y: number): void;
  /** Exam Hall: live overlays of every student's room */
  setRooms(rooms: HallRoomView[]): void;
}

/** What the Exam Hall shows in one student's room. */
export interface HallRoomView {
  roomIndex: number;
  zone: Zone;
  seat: { x: number; y: number };
  studentId: string;
  name: string;
  /** e.g. "Q2/4 · 03:12" */
  caption: string;
  emoji: string | null;
  state: 'live' | 'waiting' | 'done' | 'missed';
  online: boolean;
  speaking: boolean;
  focused: boolean;
  listening: boolean;
}

/** A rounded, chunky label (name tags, door signs, room captions). */
interface Chip {
  c: Container;
  set(text: string): void;
  paint(bg: number, fg: string, edge?: number): void;
}

interface RoomOverlay {
  frame: import('phaser').GameObjects.Rectangle;
  title: Chip;
  caption: Chip;
  emoji: Text;
  headset: Text;
  puppet: Avatar | null;
  key: string;
}

export interface SceneConfig {
  map: CampusMap;
  interactive: boolean;
  dark: boolean;
  onMove: (x: number, y: number, dir: Dir, moving: boolean) => void;
  onZone: (zone: Zone | null) => void;
  onReady: (api: SceneApi) => void;
  /** localizes map labels ("Study Hall" → "قاعة الدراسة") */
  translate?: (label: string) => string;
  /** the page's resolved font stack (next/font gives Nunito a generated family name) */
  font?: string;
}

// ---------- palette (Arzino / Lebanon: cedar, flag red, Mediterranean blue, white stone, red tile roofs) ----------

const BRAND = {
  cedar: 0x00a651,
  cedarD: 0x00843f,
  cedarInk: 0x006b37,
  flag: 0xe4252d,
  flagD: 0xb3171e,
  med: 0x1c8be0,
  medD: 0x136cb2,
  flame: 0xff9600,
  gold: 0xffc21a,
  lock: 0x9aa7a1,
  ink: 0x16262a,
  white: 0xffffff,
};

const DAY = {
  bg: 0xe6f2eb,
  grass: 0x9fd873,
  grassDark: 0x79bf55,
  grassLight: 0xbbe78f,
  stone: 0xf4ecdc,
  stoneEdge: 0xd9c8a8,
  stoneLine: 0xe8dcc4,
  plaza: 0xfbf6ec,
  plazaLine: 0xece1cc,
  wood: 0xf3d5a8,
  woodLine: 0xe2bb86,
  tile: 0xf1f8fe,
  tileAlt: 0xe4f1fc,
  tileLine: 0xd3e5f4,
  wall: 0xfbf6ec,
  wallFront: 0xdccdb0,
  wallLine: 0xbfae8e,
  hedge: 0x2f8f48,
  hedgeLight: 0x47aa5c,
  roof: 0xdc5a3c,
  roofD: 0xa83a24,
  roofLight: 0xef7f5f,
  glass: 0xcde9ff,
  water: 0x1c8be0,
  waterLight: 0x63b8f3,
  furn: 0xe3ac70,
  furnD: 0xb57a3f,
  furnLine: 0x8a5a2b,
  chipBg: 0xffffff,
  chipFg: '#16262a',
  chipEdge: 0xd5dfd9,
  shadow: 0.16,
};
const NIGHT: typeof DAY = {
  bg: 0x08130f,
  grass: 0x1d3b2a,
  grassDark: 0x152c1f,
  grassLight: 0x264a35,
  stone: 0x3a4541,
  stoneEdge: 0x29322f,
  stoneLine: 0x333d39,
  plaza: 0x34403b,
  plazaLine: 0x2b3532,
  wood: 0x3d3022,
  woodLine: 0x31261a,
  tile: 0x182b3a,
  tileAlt: 0x1c3243,
  tileLine: 0x22394c,
  wall: 0x8f897b,
  wallFront: 0x6a6559,
  wallLine: 0x4f4b42,
  hedge: 0x1a4f2a,
  hedgeLight: 0x236236,
  roof: 0x8a3726,
  roofD: 0x5e2318,
  roofLight: 0x9e4632,
  glass: 0x2f6b99,
  water: 0x0f4f86,
  waterLight: 0x2f86c9,
  furn: 0x7a5634,
  furnD: 0x5a3e24,
  furnLine: 0x3f2b18,
  chipBg: 0x16262a,
  chipFg: '#eef6f2',
  chipEdge: 0x050b09,
  shadow: 0.3,
};

const FONT = 'Nunito, "Noto Kufi Arabic", ui-rounded, system-ui, sans-serif';
const hex = (c: string) => Number.parseInt(c.replace('#', ''), 16);
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
/** f < 0 darkens, f > 0 lightens */
function shade(c: number, f: number) {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}
/** small deterministic RNG so every visitor sees the same flowers and grass */
function rng(seed: string) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (a * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which Arzino sticker stands in each map. */
const ARZINO_POSE: Record<CampusMap['id'], string> = { campus: 'welcome', study: 'reading', exam: 'teaching', hall: 'teaching' };

interface Avatar {
  c: Container;
  figure: Container;
  body: Arc;
  pupils: Arc[];
  ring: Arc;
  tween?: import('phaser').Tweens.Tween;
  dir: Dir;
  moving: boolean;
  phase: number;
}

/** Builds the Phaser scene class for one campus map (courtyard, study room, exam room or Exam Hall). */
export function createCampusScene(Phaser: PhaserNS, cfg: SceneConfig) {
  const tr = (label: string) => cfg.translate?.(label) ?? label;
  const P = cfg.dark ? NIGHT : DAY;
  const fontFamily = cfg.font || FONT;
  const pose = ARZINO_POSE[cfg.map.id] ?? 'welcome';
  const sortDepth = (baseY: number) => 10 + baseY / 1000;

  return class CampusScene extends Phaser.Scene {
    private self: Avatar | null = null;
    private selfId: string | null = null;
    private others = new Map<string, Avatar>();
    private solids!: import('phaser').Physics.Arcade.StaticGroup;
    private keys: Record<string, import('phaser').Input.Keyboard.Key> = {};
    private target: { x: number; y: number } | null = null;
    private lastSent = 0;
    private lastPos = { x: 0, y: 0, moving: false };
    private zoneId: string | null = null;
    private rooms = new Map<number, RoomOverlay>();

    constructor() {
      super('campus');
    }

    preload() {
      this.load.image(`arzino-${pose}`, `/arzino/${pose}.webp`);
    }

    create() {
      const { map } = cfg;
      this.cameras.main.setBackgroundColor(P.bg);
      this.physics.world.setBounds(0, 0, map.width, map.height);

      this.drawGround();
      for (const d of map.decor ?? []) this.drawDecor(d);
      for (const z of map.zones) this.drawZone(z);
      for (const f of map.furniture) this.drawFurniture(f);
      this.solids = this.physics.add.staticGroup();
      for (const f of map.furniture) if (f.solid) this.solid(f.x, f.y, f.w, f.h);
      for (const w of map.walls) {
        this.drawWall(w);
        this.solid(w.x, w.y, w.w, w.h);
      }
      for (const d of map.decor ?? []) {
        if (d.kind === 'window') this.drawWindow(d);
        if (d.kind === 'building') this.drawRoof(d);
      }

      if (cfg.interactive && this.input.keyboard) {
        // No key capture: typing in inputs/textareas elsewhere on the page must keep working.
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as Record<string, import('phaser').Input.Keyboard.Key>;
        this.input.on('pointerdown', (p: import('phaser').Input.Pointer) => {
          this.target = { x: p.worldX, y: p.worldY };
        });
      }

      this.scale.on('resize', () => this.fitCamera());
      this.fitCamera();
      cfg.onReady(this.api());
    }

    // ---------- helpers ----------

    private solid(x: number, y: number, w: number, h: number) {
      const r = this.add.rectangle(x + w / 2, y + h / 2, w, h);
      r.setVisible(false);
      this.solids.add(r);
    }

    /** crisp text on WebGL; the Canvas renderer draws high-resolution text too large, so it keeps 1 */
    private get res() {
      return this.game.renderer.type === Phaser.WEBGL ? 2 : 1;
    }

    private text(x: number, y: number, s: string, size: number, color: string, weight = '900') {
      return this.add.text(x, y, s, { fontFamily, fontSize: `${size}px`, fontStyle: weight, color }).setOrigin(0.5).setResolution(this.res);
    }

    /** A pill label with a darker bottom edge, like the chunky buttons of the app. `ax` = 0 left, 0.5 center, 1 right anchor. */
    private chip(x: number, y: number, s: string, o: { bg: number; fg: string; edge?: number; size?: number; ax?: number; border?: number }): Chip {
      const size = o.size ?? 12;
      const g = this.add.graphics();
      const t = this.add.text(0, 0, s, { fontFamily, fontSize: `${size}px`, fontStyle: '900', color: o.fg }).setOrigin(0, 0.5).setResolution(this.res);
      const c = this.add.container(x, y, [g, t]);
      let bg = o.bg;
      let edge = o.edge ?? shade(o.bg, -0.25);
      const ax = o.ax ?? 0.5;
      const draw = () => {
        const padX = Math.round(size * 0.75);
        const h = Math.round(size * 1.85);
        const w = Math.max(h, t.width + padX * 2);
        const left = -ax * w;
        g.clear();
        g.fillStyle(edge, 1).fillRoundedRect(left, -h / 2 + 3, w, h, h / 2);
        g.fillStyle(bg, 1).fillRoundedRect(left, -h / 2, w, h, h / 2);
        if (o.border !== undefined) g.lineStyle(1.5, o.border, 1).strokeRoundedRect(left, -h / 2, w, h, h / 2);
        t.setPosition(left + padX, -0.5);
      };
      draw();
      return {
        c,
        set: (next) => {
          if (t.text === next) return;
          t.setText(next);
          draw();
        },
        paint: (b, fg, e) => {
          bg = b;
          edge = e ?? shade(b, -0.25);
          t.setColor(fg);
          draw();
        },
      };
    }

    // ---------- ground ----------

    private drawGround() {
      const { map } = cfg;
      const g = this.add.graphics().setDepth(0);
      const all: Rect = { x: 0, y: 0, w: map.width, h: map.height };
      if (map.floor === 'mint') this.grass(g, all, map.id);
      else if (map.floor === 'sunny') this.planks(g, all);
      else if (map.floor === 'sky') this.tiles(g, all, 40);
      else {
        g.fillStyle(P.plaza, 1).fillRect(0, 0, map.width, map.height);
        this.tileLines(g, all, 48, P.plazaLine);
      }
    }

    private grass(g: Graphics, r: Rect, seed: string) {
      const rand = rng(seed);
      g.fillStyle(P.grass, 1).fillRect(r.x, r.y, r.w, r.h);
      const blotches = Math.round((r.w * r.h) / 38_000);
      for (let i = 0; i < blotches; i++) {
        g.fillStyle(P.grassLight, 0.55).fillEllipse(r.x + rand() * r.w, r.y + rand() * r.h, 40 + rand() * 70, 18 + rand() * 26);
      }
      const tufts = Math.round((r.w * r.h) / 7000);
      g.lineStyle(2, P.grassDark, 0.9);
      for (let i = 0; i < tufts; i++) {
        const x = r.x + rand() * r.w;
        const y = r.y + rand() * r.h;
        g.lineBetween(x, y, x - 3, y - 5);
        g.lineBetween(x, y, x, y - 7);
        g.lineBetween(x, y, x + 3, y - 5);
      }
    }

    private planks(g: Graphics, r: Rect) {
      g.fillStyle(P.wood, 1).fillRect(r.x, r.y, r.w, r.h);
      const ph = 26;
      g.lineStyle(2, P.woodLine, 0.9);
      for (let y = r.y, row = 0; y < r.y + r.h; y += ph, row++) {
        g.lineBetween(r.x, y, r.x + r.w, y);
        for (let x = r.x + 40 + (row % 2) * 70; x < r.x + r.w; x += 140) g.lineBetween(x, y, x, Math.min(y + ph, r.y + r.h));
      }
    }

    private tiles(g: Graphics, r: Rect, size: number) {
      g.fillStyle(P.tile, 1).fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(P.tileAlt, 1);
      for (let y = r.y, j = 0; y < r.y + r.h; y += size, j++) {
        for (let x = r.x + ((j % 2) * size), i = 0; x < r.x + r.w; x += size * 2, i++) g.fillRect(x, y, Math.min(size, r.x + r.w - x), Math.min(size, r.y + r.h - y));
      }
      this.tileLines(g, r, size, P.tileLine);
    }

    private tileLines(g: Graphics, r: Rect, size: number, color: number) {
      g.lineStyle(1.5, color, 1);
      for (let x = r.x; x <= r.x + r.w; x += size) g.lineBetween(x, r.y, x, r.y + r.h);
      for (let y = r.y; y <= r.y + r.h; y += size) g.lineBetween(r.x, y, r.x + r.w, y);
    }

    // ---------- decor ----------

    private drawDecor(d: Decor) {
      switch (d.kind) {
        case 'building': {
          const g = this.add.graphics().setDepth(0.3);
          if (d.floor === 'tile') this.tiles(g, d, 40);
          else this.planks(g, d);
          break;
        }
        case 'path': {
          const g = this.add.graphics().setDepth(0.2);
          g.fillStyle(P.stoneEdge, 1).fillRoundedRect(d.x, d.y + 3, d.w, d.h, 14);
          g.fillStyle(P.stone, 1).fillRoundedRect(d.x, d.y, d.w, d.h, 14);
          // offset cobbles
          g.lineStyle(1.5, P.stoneLine, 1);
          const s = 28;
          for (let y = d.y + s, row = 0; y < d.y + d.h - 6; y += s, row++) {
            g.lineBetween(d.x + 6, y, d.x + d.w - 6, y);
          }
          for (let y = d.y, row = 0; y < d.y + d.h; y += s, row++) {
            for (let x = d.x + 20 + (row % 2) * 22; x < d.x + d.w - 8; x += 44) g.lineBetween(x, y + 4, x, Math.min(y + s, d.y + d.h - 4));
          }
          break;
        }
        case 'plaza': {
          const g = this.add.graphics().setDepth(0.25);
          g.fillStyle(P.stoneEdge, 1).fillRoundedRect(d.x, d.y + 4, d.w, d.h, 32);
          g.fillStyle(P.plaza, 1).fillRoundedRect(d.x, d.y, d.w, d.h, 32);
          g.lineStyle(1.5, P.plazaLine, 1);
          for (let x = d.x + 48; x < d.x + d.w; x += 48) g.lineBetween(x, d.y + 10, x, d.y + d.h - 10);
          for (let y = d.y + 48; y < d.y + d.h; y += 48) g.lineBetween(d.x + 10, y, d.x + d.w - 10, y);
          // a white-and-red mosaic border, Lebanese flag colors
          for (let x = d.x + 26, i = 0; x < d.x + d.w - 20; x += 24, i++) {
            g.fillStyle(i % 2 ? P.stoneEdge : BRAND.flag, cfg.dark ? 0.5 : 0.75);
            g.fillCircle(x, d.y + 14, 3).fillCircle(x, d.y + d.h - 14, 3);
          }
          break;
        }
        case 'flowers': {
          const g = this.add.graphics().setDepth(0.15);
          const rand = rng(`flowers${d.x}:${d.y}`);
          const petals = [0xffffff, BRAND.flag, BRAND.gold, 0xff9ec4, 0xffffff];
          const n = Math.round((d.w * d.h) / 1900);
          for (let i = 0; i < n; i++) {
            const x = d.x + rand() * d.w;
            const y = d.y + rand() * d.h;
            const col = petals[Math.floor(rand() * petals.length)];
            g.fillStyle(P.grassDark, 1).fillEllipse(x - 4, y + 3, 6, 3).fillEllipse(x + 4, y + 3, 6, 3);
            g.fillStyle(col, cfg.dark ? 0.7 : 1);
            g.fillCircle(x - 2.6, y, 2.6).fillCircle(x + 2.6, y, 2.6).fillCircle(x, y - 2.6, 2.6).fillCircle(x, y + 2.6, 2.6);
            g.fillStyle(BRAND.gold, 1).fillCircle(x, y, 1.6);
          }
          break;
        }
        case 'flag':
          this.drawFlag(d);
          break;
        case 'window':
          break; // drawn on top of the walls
      }
    }

    /** The Lebanese flag on a pole, waving. */
    private drawFlag(d: Decor) {
      const baseX = d.x + 6;
      const baseY = d.y + d.h;
      const pole = this.add.graphics().setDepth(sortDepth(baseY));
      pole.fillStyle(0x000000, P.shadow).fillEllipse(baseX + 4, baseY, 22, 7);
      pole.fillStyle(P.wallFront, 1).fillRoundedRect(baseX - 7, baseY - 6, 14, 8, 3);
      pole.fillStyle(0xb9c3c0, 1).fillRect(baseX - 1.5, d.y - 4, 3, d.h);
      pole.fillStyle(BRAND.gold, 1).fillCircle(baseX, d.y - 5, 3.2);
      const fw = Math.max(30, d.w - 4);
      const fh = Math.round(fw * 0.66);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.12).fillRect(0, 2, fw, fh);
      g.fillStyle(BRAND.flag, 1).fillRect(0, 0, fw, fh);
      g.fillStyle(0xffffff, 1).fillRect(0, fh / 4, fw, fh / 2);
      // cedar in the middle
      const cx = fw / 2;
      const cy = fh / 2;
      g.fillStyle(BRAND.cedar, 1);
      g.fillTriangle(cx, cy - 7, cx - 5, cy - 1, cx + 5, cy - 1);
      g.fillTriangle(cx, cy - 4, cx - 8, cy + 3, cx + 8, cy + 3);
      g.fillTriangle(cx, cy, cx - 10, cy + 6, cx + 10, cy + 6);
      g.fillStyle(0x8a5a2b, 1).fillRect(cx - 1, cy + 6, 2, 2);
      const flag = this.add.container(baseX + 1.5, d.y, [g]).setDepth(sortDepth(baseY) + 0.0001);
      this.tweens.add({ targets: flag, scaleX: { from: 1, to: 0.86 }, scaleY: { from: 1, to: 1.04 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    private drawWindow(d: Decor) {
      const g = this.add.graphics().setDepth(2.2);
      g.fillStyle(P.wallLine, 1).fillRoundedRect(d.x - 2, d.y + 1, d.w + 4, d.h - 2, 3);
      g.fillStyle(cfg.dark ? 0xffd27a : P.glass, cfg.dark ? 0.85 : 1).fillRoundedRect(d.x, d.y + 3, d.w, d.h - 6, 2);
      g.lineStyle(2, P.wall, 1);
      for (let x = d.x + 20; x < d.x + d.w - 4; x += 20) g.lineBetween(x, d.y + 3, x, d.y + d.h - 3);
      if (!cfg.dark) g.fillStyle(0xffffff, 0.7).fillRect(d.x + 3, d.y + 5, Math.min(10, d.w / 4), 2);
    }

    /** Red-tile roof over the top wall of a white stone building (cut away so you can see inside). */
    private drawRoof(d: Decor) {
      const g = this.add.graphics().setDepth(2.4);
      const x = d.x - 12;
      const w = d.w + 24;
      const top = d.y - 34;
      const h = 52;
      g.fillStyle(0x000000, P.shadow).fillRoundedRect(x + 2, top + h - 2, w, 10, 5);
      g.fillStyle(P.roofD, 1).fillRoundedRect(x, top, w, h, 8);
      const tw = 18;
      for (let row = 0; row < 3; row++) {
        const y = top + 6 + row * 14;
        for (let tx = x + 4 + (row % 2) * (tw / 2); tx < x + w - 6; tx += tw) {
          const ww = Math.min(tw - 2, x + w - 4 - tx);
          if (ww < 6) continue;
          g.fillStyle(P.roof, 1).fillRoundedRect(tx, y, ww, 15, { tl: 2, tr: 2, bl: 7, br: 7 });
          g.fillStyle(P.roofLight, 1).fillRect(tx + 2, y + 1, ww - 4, 2);
        }
      }
      g.fillStyle(P.roofD, 1).fillRoundedRect(x - 2, top - 3, w + 4, 8, 4);
      // white stone front under the roof
      g.fillStyle(P.wall, 1).fillRect(x + 6, top + h - 6, w - 12, 8);
      g.fillStyle(P.wallFront, 1).fillRect(x + 6, top + h + 2, w - 12, 4);
    }

    // ---------- walls & zones ----------

    private drawWall(w: Rect) {
      const { map } = cfg;
      const glass = map.id === 'hall' && (w.w === 8 || w.h === 8);
      const border = w.x <= 0 || w.y <= 0 || w.x + w.w >= map.width || w.y + w.h >= map.height;
      const g = this.add.graphics().setDepth(2);
      if (glass) {
        g.fillStyle(P.glass, cfg.dark ? 0.75 : 0.9).fillRect(w.x, w.y, w.w, w.h);
        g.lineStyle(1.5, BRAND.med, cfg.dark ? 0.7 : 0.8).strokeRect(w.x, w.y, w.w, w.h);
        g.fillStyle(0xffffff, cfg.dark ? 0.25 : 0.8);
        if (w.w > w.h) g.fillRect(w.x + 4, w.y + 2, w.w - 8, 1.5);
        else g.fillRect(w.x + 2, w.y + 4, 1.5, w.h - 8);
        return;
      }
      if (border && map.floor === 'mint') {
        // a cedar hedge around the courtyard
        g.fillStyle(P.hedge, 1).fillRect(w.x, w.y, w.w, w.h);
        g.fillStyle(P.hedgeLight, 1);
        const horizontal = w.w >= w.h;
        const len = horizontal ? w.w : w.h;
        for (let i = 6; i < len; i += 13) {
          if (horizontal) g.fillCircle(w.x + i, w.y + w.h / 2 - 1, 7);
          else g.fillCircle(w.x + w.w / 2 - 1, w.y + i, 7);
        }
        return;
      }
      // white limestone with a darker front face
      if (w.w >= w.h) g.fillStyle(P.wallFront, 1).fillRect(w.x, w.y + w.h, w.w, 6);
      g.fillStyle(P.wall, 1).fillRect(w.x, w.y, w.w, w.h);
      g.lineStyle(1.5, P.wallLine, 0.6).strokeRect(w.x, w.y, w.w, w.h);
    }

    private drawZone(z: Zone) {
      const door = z.kind === 'study_door' || z.kind === 'exam_door';
      if (!door && z.kind !== 'exam_desk' && z.kind !== 'stage') return;
      const color = z.kind === 'exam_door' || z.kind === 'exam_desk' ? BRAND.med : z.kind === 'stage' ? BRAND.gold : BRAND.cedar;
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(color, door ? 0.28 : 0.14).fillRoundedRect(z.x, z.y, z.w, z.h, 14);
      g.lineStyle(3, color, door ? 0.95 : 0.45).strokeRoundedRect(z.x, z.y, z.w, z.h, 14);
      if (door) {
        // a welcome mat + glow
        g.fillStyle(color, 0.35).fillRoundedRect(z.x + 10, z.y + z.h / 2 - 14, z.w - 20, 28, 8);
        this.tweens.add({ targets: g, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
        const sign = this.chip(z.x + z.w / 2, z.y - 18, `🚪 ${tr(z.label)}`, { bg: color, fg: '#ffffff', size: 16 });
        sign.c.setDepth(30);
        this.tweens.add({ targets: sign.c, y: sign.c.y - 4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    // ---------- furniture ----------

    private drawFurniture(f: Furniture) {
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      const base = f.y + f.h;
      switch (f.kind) {
        case 'rug': {
          const g = this.add.graphics().setDepth(0.5);
          const tint = cfg.map.floor === 'sky' ? BRAND.med : cfg.map.floor === 'sunny' ? BRAND.flag : BRAND.cedar;
          g.fillStyle(tint, cfg.dark ? 0.22 : 0.12).fillRoundedRect(f.x, f.y, f.w, f.h, 22);
          g.lineStyle(3, tint, cfg.dark ? 0.45 : 0.3).strokeRoundedRect(f.x + 8, f.y + 8, f.w - 16, f.h - 16, 16);
          g.fillStyle(tint, cfg.dark ? 0.45 : 0.3);
          for (let x = f.x + 28; x < f.x + f.w - 20; x += 26) {
            g.fillTriangle(x, f.y + 16, x - 5, f.y + 21, x + 5, f.y + 21).fillTriangle(x, f.y + 26, x - 5, f.y + 21, x + 5, f.y + 21);
            g.fillTriangle(x, f.y + f.h - 26, x - 5, f.y + f.h - 21, x + 5, f.y + f.h - 21).fillTriangle(x, f.y + f.h - 16, x - 5, f.y + f.h - 21, x + 5, f.y + f.h - 21);
          }
          if (f.label) this.chip(cx, f.y + 24, tr(f.label), { bg: tint, fg: '#ffffff', size: 17 }).c.setDepth(1);
          break;
        }
        case 'table':
        case 'desk':
        case 'bench': {
          const g = this.add.graphics().setDepth(3);
          const r = f.kind === 'bench' ? 8 : 12;
          g.fillStyle(0x000000, P.shadow).fillRoundedRect(f.x + 3, f.y + 9, f.w, f.h, r);
          g.fillStyle(P.furnD, 1).fillRoundedRect(f.x, f.y + 6, f.w, f.h, r);
          g.fillStyle(P.furn, 1).fillRoundedRect(f.x, f.y, f.w, f.h, r);
          g.lineStyle(2, P.furnLine, 0.55).strokeRoundedRect(f.x, f.y, f.w, f.h + 6, r);
          if (f.kind === 'bench') {
            g.lineStyle(2, P.furnD, 0.8);
            for (let y = f.y + f.h / 3; y < f.y + f.h - 2; y += f.h / 3) g.lineBetween(f.x + 6, y, f.x + f.w - 6, y);
          } else if (f.kind === 'desk') {
            // an open book and a pencil
            g.fillStyle(0xffffff, 1).fillRoundedRect(cx - 17, f.y + 8, 16, 20, 2).fillRoundedRect(cx + 1, f.y + 8, 16, 20, 2);
            g.lineStyle(1.5, BRAND.cedar, 1).lineBetween(cx - 14, f.y + 14, cx - 4, f.y + 14).lineBetween(cx + 4, f.y + 14, cx + 14, f.y + 14);
            g.lineStyle(1.5, BRAND.med, 1).lineBetween(cx - 14, f.y + 19, cx - 6, f.y + 19).lineBetween(cx + 4, f.y + 19, cx + 12, f.y + 19);
            g.fillStyle(BRAND.gold, 1).fillRect(cx + 20, f.y + 10, 4, 16);
            g.fillStyle(BRAND.flag, 1).fillRect(cx + 20, f.y + 8, 4, 3);
          } else {
            // cups, notes and a little plant on the table
            g.fillStyle(0xffffff, 1).fillCircle(f.x + 22, cy - 2, 7);
            g.fillStyle(BRAND.flag, 1).fillCircle(f.x + 22, cy - 2, 4);
            g.fillStyle(BRAND.gold, 1).fillRoundedRect(f.x + f.w - 38, f.y + 10, 18, 14, 2);
            g.fillStyle(BRAND.med, 0.9).fillRoundedRect(f.x + f.w - 30, f.y + 18, 18, 14, 2);
          }
          break;
        }
        case 'sofa': {
          const g = this.add.graphics().setDepth(3);
          const col = BRAND.cedar;
          const vertical = f.h > f.w;
          g.fillStyle(0x000000, P.shadow).fillRoundedRect(f.x + 3, f.y + 9, f.w, f.h, 14);
          g.fillStyle(shade(col, -0.3), 1).fillRoundedRect(f.x, f.y + 6, f.w, f.h, 14);
          g.fillStyle(shade(col, -0.12), 1).fillRoundedRect(f.x, f.y, f.w, f.h, 14);
          const n = Math.max(2, Math.round((vertical ? f.h : f.w) / 55));
          const pad = 7;
          for (let i = 0; i < n; i++) {
            if (vertical) {
              const ch = (f.h - pad * 2) / n;
              g.fillStyle(shade(col, 0.15), 1).fillRoundedRect(f.x + pad + 6, f.y + pad + i * ch + 2, f.w - pad * 2 - 6, ch - 4, 8);
            } else {
              const cw = (f.w - pad * 2) / n;
              g.fillStyle(shade(col, 0.15), 1).fillRoundedRect(f.x + pad + i * cw + 2, f.y + pad + 6, cw - 4, f.h - pad * 2 - 6, 8);
            }
          }
          break;
        }
        case 'shelf': {
          const g = this.add.graphics().setDepth(3);
          g.fillStyle(0x000000, P.shadow).fillRect(f.x + 3, f.y + 8, f.w, f.h);
          g.fillStyle(P.furnLine, 1).fillRoundedRect(f.x, f.y, f.w, f.h + 6, 4);
          g.fillStyle(P.furnD, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 4);
          const books = [BRAND.flag, BRAND.med, BRAND.gold, BRAND.cedar, 0xffffff, BRAND.flame];
          const rand = rng(`shelf${f.x}${f.y}`);
          for (let x = f.x + 5, i = 0; x < f.x + f.w - 8; i++) {
            const bw = 7 + Math.floor(rand() * 5);
            const bh = f.h - 10 - Math.floor(rand() * 8);
            g.fillStyle(books[i % books.length], 1).fillRoundedRect(x, f.y + f.h - 5 - bh, bw, bh, 2);
            x += bw + 2;
          }
          break;
        }
        case 'plant': {
          const g = this.add.graphics().setDepth(sortDepth(base));
          g.fillStyle(0x000000, P.shadow).fillEllipse(cx + 2, base + 1, f.w * 0.8, 8);
          g.fillStyle(0xb5532f, 1).fillRoundedRect(cx - f.w * 0.3, base - f.h * 0.42, f.w * 0.6, f.h * 0.42, { tl: 3, tr: 3, bl: 8, br: 8 });
          g.fillStyle(0xd9774b, 1).fillRoundedRect(cx - f.w * 0.36, base - f.h * 0.48, f.w * 0.72, 8, 4);
          g.fillStyle(BRAND.cedarD, 1).fillEllipse(cx - 8, base - f.h * 0.62, 18, 26).fillEllipse(cx + 8, base - f.h * 0.62, 18, 26);
          g.fillStyle(BRAND.cedar, 1).fillEllipse(cx, base - f.h * 0.8, 18, 30);
          g.fillStyle(0x6fd38c, 1).fillEllipse(cx - 2, base - f.h * 0.86, 6, 12);
          break;
        }
        case 'tree':
          this.drawCedar(f);
          break;
        case 'fountain': {
          const g = this.add.graphics().setDepth(3);
          const r = f.w / 2;
          g.fillStyle(0x000000, P.shadow).fillEllipse(cx + 3, cy + 8, f.w + 6, f.h + 4);
          g.fillStyle(P.stoneEdge, 1).fillCircle(cx, cy + 5, r);
          g.fillStyle(P.wall, 1).fillCircle(cx, cy, r);
          g.fillStyle(P.water, 1).fillCircle(cx, cy, r - 11);
          g.fillStyle(P.waterLight, 0.6).fillCircle(cx - 8, cy - 8, r - 26);
          g.fillStyle(P.stoneEdge, 1).fillCircle(cx, cy + 2, 13);
          g.fillStyle(P.wall, 1).fillCircle(cx, cy, 12);
          g.fillStyle(P.waterLight, 1).fillCircle(cx, cy - 1, 6);
          // ripples
          for (let i = 0; i < 2; i++) {
            const ring = this.add.circle(cx, cy, r - 14).setStrokeStyle(2, 0xffffff, 0.7).setDepth(3.1);
            this.tweens.add({ targets: ring, scale: { from: 0.35, to: 1 }, alpha: { from: 0.9, to: 0 }, duration: 2200, delay: i * 1100, repeat: -1 });
          }
          // splashing drops
          for (let i = 0; i < 4; i++) {
            const drop = this.add.circle(cx, cy - 4, 2.4, 0xffffff, 0.9).setDepth(3.2);
            const ang = (i / 4) * Math.PI * 2 + 0.4;
            this.tweens.add({ targets: drop, x: cx + Math.cos(ang) * 22, y: cy + Math.sin(ang) * 14 - 2, alpha: { from: 1, to: 0 }, duration: 900, delay: i * 220, repeat: -1, ease: 'Quad.easeOut' });
          }
          break;
        }
        case 'board': {
          const g = this.add.graphics().setDepth(3);
          if (cfg.map.id === 'campus') {
            // the school's stone entrance sign with a red-tile cap
            g.fillStyle(0x000000, P.shadow).fillRoundedRect(f.x + 4, f.y + 10, f.w, f.h, 12);
            g.fillStyle(P.wallFront, 1).fillRoundedRect(f.x, f.y + 6, f.w, f.h, 12);
            g.fillStyle(P.wall, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 12);
            g.fillStyle(P.roofD, 1).fillRoundedRect(f.x - 8, f.y - 10, f.w + 16, 16, 6);
            for (let x = f.x - 4; x < f.x + f.w + 4; x += 14) g.fillStyle(P.roof, 1).fillRoundedRect(x, f.y - 8, 12, 12, { tl: 2, tr: 2, bl: 6, br: 6 });
            g.fillStyle(BRAND.cedar, 1).fillTriangle(f.x + 22, f.y + 18, f.x + 14, f.y + 32, f.x + 30, f.y + 32);
            g.fillTriangle(f.x + 22, f.y + 26, f.x + 10, f.y + 44, f.x + 34, f.y + 44);
            if (f.label) this.text(cx + 12, cy + 4, tr(f.label), 21, cfg.dark ? '#16262a' : css(BRAND.cedarInk)).setDepth(4);
          } else {
            // chalkboard with doodles
            g.fillStyle(0x000000, P.shadow).fillRoundedRect(f.x + 3, f.y + 8, f.w, f.h, 8);
            g.fillStyle(P.furnD, 1).fillRoundedRect(f.x, f.y, f.w, f.h + 5, 8);
            g.fillStyle(0x245c45, 1).fillRoundedRect(f.x + 5, f.y + 5, f.w - 10, f.h - 10, 5);
            g.lineStyle(2, 0xffffff, 0.45);
            g.strokeTriangle(f.x + 18, f.y + f.h - 14, f.x + 44, f.y + f.h - 14, f.x + 18, f.y + 16);
            g.strokeCircle(f.x + f.w - 30, cy, 12);
            g.lineBetween(f.x + f.w - 30, cy, f.x + f.w - 18, cy);
            if (f.label) this.text(cx, cy, tr(f.label), 15, '#ffffff').setDepth(4);
          }
          break;
        }
        case 'lamp': {
          const glow = this.add.circle(cx, cy - 8, f.w * 1.3, BRAND.gold, cfg.dark ? 0.28 : 0.14).setDepth(2.9);
          this.tweens.add({ targets: glow, scale: { from: 0.92, to: 1.08 }, alpha: { from: glow.alpha * 0.7, to: glow.alpha }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          const g = this.add.graphics().setDepth(sortDepth(base));
          g.fillStyle(0x000000, P.shadow).fillEllipse(cx + 2, base, f.w * 0.8, 8);
          g.fillStyle(0x4b5c60, 1).fillRoundedRect(cx - 8, base - 6, 16, 6, 3);
          g.fillStyle(0x4b5c60, 1).fillRect(cx - 2, base - f.h - 4, 4, f.h);
          g.fillStyle(0x4b5c60, 1).fillRoundedRect(cx - 9, base - f.h - 18, 18, 18, 4);
          g.fillStyle(cfg.dark ? 0xffe08a : BRAND.gold, 1).fillRoundedRect(cx - 6, base - f.h - 15, 12, 12, 3);
          break;
        }
        case 'arzino':
          this.drawArzino(f);
          break;
      }
    }

    /** A Lebanese cedar: flat, layered tiers on a short trunk. Swings a little in the breeze. */
    private drawCedar(f: Furniture) {
      const cx = f.x + f.w / 2;
      const base = f.y + f.h;
      const shadow = this.add.graphics().setDepth(2.95);
      shadow.fillStyle(0x000000, P.shadow).fillEllipse(cx + 8, base - 2, f.w * 1.25, f.h * 0.34);
      const g = this.add.graphics();
      const W = f.w;
      const H = f.h;
      g.fillStyle(0x7a4a26, 1).fillRoundedRect(-W * 0.08, -H * 0.42, W * 0.16, H * 0.44, 3);
      const dark = cfg.dark ? 0x14502a : 0x1d7a3c;
      const mid = cfg.dark ? 0x1d6a37 : BRAND.cedar;
      const light = cfg.dark ? 0x2a8048 : 0x4cc56c;
      const tiers = [
        { y: -H * 0.42, w: W * 1.3, h: H * 0.3 },
        { y: -H * 0.68, w: W * 1.0, h: H * 0.27 },
        { y: -H * 0.92, w: W * 0.7, h: H * 0.24 },
        { y: -H * 1.1, w: W * 0.36, h: H * 0.2 },
      ];
      for (const t of tiers) {
        g.fillStyle(dark, 1).fillEllipse(0, t.y + 5, t.w, t.h);
        g.fillStyle(mid, 1).fillEllipse(0, t.y, t.w, t.h);
        g.fillStyle(light, 1).fillEllipse(-t.w * 0.12, t.y - t.h * 0.22, t.w * 0.55, t.h * 0.38);
      }
      const tree = this.add.container(cx, base, [g]).setDepth(sortDepth(base));
      this.tweens.add({ targets: tree, angle: { from: -1.2, to: 1.2 }, duration: 2600 + (f.x % 7) * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    /** The real Arzino sticker, standing in the room and bobbing gently. */
    private drawArzino(f: Furniture) {
      const cx = f.x + f.w / 2;
      const base = f.y + f.h + 4;
      const h = Math.round(f.h * 1.9);
      const g = this.add.graphics().setDepth(sortDepth(base) - 0.0001);
      g.fillStyle(0x000000, P.shadow).fillEllipse(cx, base - 2, f.w * 0.95, 12);
      const key = this.sticker(`arzino-${pose}`, h);
      let obj: import('phaser').GameObjects.Image | Graphics;
      if (key) {
        const img = this.add.image(cx, base, key).setOrigin(0.5, 1);
        const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
        img.setDisplaySize((src.width / src.height) * h, h);
        obj = img;
      } else {
        // sticker missing: a tiny cedar stands in
        const fb = this.add.graphics();
        fb.fillStyle(BRAND.cedar, 1).fillTriangle(cx, base - h * 0.8, cx - f.w * 0.4, base - 6, cx + f.w * 0.4, base - 6);
        obj = fb;
      }
      obj.setDepth(sortDepth(base));
      this.tweens.add({ targets: obj, y: '-=5', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    /** Pre-scales a big sticker on a canvas (smooth downscale), so it stays crisp without mipmaps. */
    private sticker(key: string, h: number): string | null {
      if (!this.textures.exists(key)) return null;
      const out = `${key}@${h}`;
      if (this.textures.exists(out)) return out;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      if (!src?.width) return key;
      const th = Math.round(h * 2.5);
      const tw = Math.round((src.width / src.height) * th);
      const tex = this.textures.createCanvas(out, tw, th);
      if (!tex) return key;
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, tw, th);
      tex.refresh();
      return out;
    }

    // ---------- avatars ----------

    private makeAvatar(p: PlayerState, isSelf: boolean): Avatar {
      const color = hex(p.color);
      const edge = shade(color, -0.32);
      const parts: import('phaser').GameObjects.GameObject[] = [];
      parts.push(this.add.ellipse(0, 17, 32, 10, 0x000000, P.shadow + 0.04));
      if (isSelf) parts.push(this.add.ellipse(0, 17, 42, 15).setStrokeStyle(3, BRAND.cedar, 0.9));
      const ring = this.add.circle(0, 0, 22).setStrokeStyle(3.5, BRAND.cedar, 1).setVisible(false);
      parts.push(ring);

      const body = this.add.circle(0, 0, 15, color).setStrokeStyle(3, edge, 1);
      const shine = this.add.ellipse(-5, -8, 10, 6, 0xffffff, 0.35);
      const cheeks = [this.add.ellipse(-9.5, 4, 5, 3, 0xff7d96, 0.55), this.add.ellipse(9.5, 4, 5, 3, 0xff7d96, 0.55)];
      const eyeL = this.add.circle(-5.5, -2, 4.4, 0xffffff).setStrokeStyle(1.2, edge, 0.8);
      const eyeR = this.add.circle(5.5, -2, 4.4, 0xffffff).setStrokeStyle(1.2, edge, 0.8);
      const pupilL = this.add.circle(-5.5, -1.5, 2.2, BRAND.ink);
      const pupilR = this.add.circle(5.5, -1.5, 2.2, BRAND.ink);
      const mouth = this.add.graphics();
      mouth.lineStyle(2, BRAND.ink, 0.85).beginPath().arc(0, 4.5, 3.4, 0.15 * Math.PI, 0.85 * Math.PI).strokePath();
      // a tiny cedar sprout on top of every head
      const sprout = this.add.graphics();
      sprout.fillStyle(BRAND.cedarD, 1).fillTriangle(0, -23, -5, -15, 5, -15);
      sprout.fillStyle(BRAND.cedar, 1).fillTriangle(0, -21, -3.5, -15.5, 3.5, -15.5);
      const figure = this.add.container(0, 0, [sprout, body, shine, ...cheeks, eyeL, eyeR, pupilL, pupilR, mouth]);
      parts.push(figure);

      const label = isSelf ? `${p.name} ★` : p.name;
      const tag = isSelf
        ? this.chip(0, 35, label, { bg: BRAND.cedar, fg: '#ffffff', edge: BRAND.cedarD, size: 13 })
        : this.chip(0, 35, label, { bg: P.chipBg, fg: P.chipFg, edge: P.chipEdge, size: 13, border: cfg.dark ? undefined : P.chipEdge });
      parts.push(tag.c);

      const c = this.add.container(p.x, p.y, parts).setDepth(10 + p.y / 1000);
      this.tweens.add({ targets: ring, scale: { from: 0.95, to: 1.2 }, alpha: { from: 1, to: 0.45 }, duration: 480, yoyo: true, repeat: -1 });
      return { c, figure, body, pupils: [pupilL, pupilR], ring, dir: p.dir, moving: false, phase: Math.random() * 10 };
    }

    private look(a: Avatar, dir: Dir) {
      a.dir = dir;
      const d = { up: [0, -2.2], down: [0, 1.4], left: [-2, 0], right: [2, 0] }[dir];
      a.pupils[0].setPosition(-5.5 + d[0], -1.5 + d[1]);
      a.pupils[1].setPosition(5.5 + d[0], -1.5 + d[1]);
    }

    /** little hop while walking */
    private bob(a: Avatar, now: number) {
      const target = a.moving ? -Math.abs(Math.sin(now / 85 + a.phase)) * 4 : 0;
      a.figure.y += (target - a.figure.y) * 0.5;
    }

    private fitCamera() {
      const cam = this.cameras.main;
      const { width, height } = this.scale.gameSize;
      const { map } = cfg;
      const fit = Math.min(width / map.width, height / map.height);
      const roams = map.id === 'campus' || map.id === 'hall';
      if (!roams || fit >= 0.9) {
        cam.stopFollow();
        cam.setZoom(Math.min(1.4, fit));
        cam.removeBounds();
        cam.centerOn(map.width / 2, map.height / 2);
      } else {
        // the hall fills the view (no empty band under a short hall), never zoomed out below half size
        const cover = Math.max(width / map.width, height / map.height);
        cam.setZoom(map.id === 'hall' ? Math.max(0.5, Math.min(1.2, cover)) : Math.max(0.72, Math.min(1, fit * 1.7)));
        cam.setBounds(0, 0, map.width, map.height);
        if (this.self) cam.startFollow(this.self.c, true, 0.15, 0.15);
      }
    }

    // ---------- Exam Hall overlays ----------

    private roomOverlay(v: HallRoomView): RoomOverlay {
      const z = v.zone;
      const frame = this.add.rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, BRAND.med, 0.08).setStrokeStyle(4, BRAND.cedar, 0).setDepth(0.6);
      const title = this.chip(z.x + 8, z.y + 18, '', { bg: P.chipBg, fg: P.chipFg, edge: P.chipEdge, size: 12, ax: 0, border: cfg.dark ? undefined : P.chipEdge });
      title.c.setDepth(30);
      const caption = this.chip(z.x + z.w - 8, z.y + 18, '', { bg: BRAND.med, fg: '#ffffff', edge: BRAND.medD, size: 11, ax: 1 });
      caption.c.setDepth(30);
      const emoji = this.add.text(v.seat.x - 36, v.seat.y + 2, '', { fontSize: '26px' }).setOrigin(0.5).setDepth(31);
      const headset = this.add.text(z.x + z.w - 18, z.y + z.h - 18, '🎧', { fontSize: '20px' }).setOrigin(0.5).setDepth(31).setVisible(false);
      this.tweens.add({ targets: emoji, y: emoji.y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return { frame, title, caption, emoji, headset, puppet: null, key: '' };
    }

    private updateRoom(o: RoomOverlay, v: HallRoomView) {
      const tint = { live: BRAND.med, waiting: BRAND.lock, done: BRAND.cedar, missed: BRAND.flag }[v.state];
      o.frame.setFillStyle(tint, v.state === 'live' ? 0.14 : 0.08);
      o.frame.setStrokeStyle(4, BRAND.cedar, v.focused ? 1 : 0);
      o.title.set(`#${v.roomIndex} ${v.name}`);
      if (v.focused) o.title.paint(BRAND.cedar, '#ffffff', BRAND.cedarD);
      else o.title.paint(P.chipBg, P.chipFg, P.chipEdge);
      o.caption.set(v.caption);
      o.caption.paint(tint, '#ffffff');
      o.caption.c.setVisible(!!v.caption);
      o.emoji.setText(v.emoji ?? '');
      o.headset.setVisible(v.listening);
      const key = `${v.studentId}:${v.online}`;
      if (o.key !== key) {
        o.key = key;
        o.puppet?.c.destroy();
        o.puppet = null;
        if (v.online) {
          o.puppet = this.makeAvatar({ userId: v.studentId, name: v.name, role: 'STUDENT', color: avatarColor(v.studentId), x: v.seat.x, y: v.seat.y, dir: 'up', moving: false, spectator: false }, false);
          o.puppet.c.setScale(0.2);
          this.tweens.add({ targets: o.puppet.c, scale: 1, duration: 300, ease: 'Back.easeOut' });
        }
      }
      o.puppet?.ring.setVisible(v.speaking);
      o.puppet?.c.setAlpha(v.state === 'live' ? 1 : 0.55);
    }

    /** emoji in a speech bubble that pops above the avatar, then floats away */
    private bubble(x: number, y: number, emoji: string) {
      const g = this.add.graphics();
      const w = 46;
      const h = 40;
      g.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2 + 1, -h + 3, w, h, 14);
      g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h, w, h, 14);
      g.fillTriangle(-7, -2, 7, -2, 0, 9);
      g.lineStyle(2.5, BRAND.ink, 0.85).strokeRoundedRect(-w / 2, -h, w, h, 14);
      g.fillStyle(0xffffff, 1).fillRect(-6, -3.5, 12, 4);
      g.lineStyle(2.5, BRAND.ink, 0.85).lineBetween(-7, -1, 0, 9).lineBetween(7, -1, 0, 9);
      const t = this.add.text(0, -h / 2, emoji, { fontSize: '24px' }).setOrigin(0.5);
      const c = this.add.container(x, y, [g, t]).setDepth(50).setScale(0.2);
      this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: c, y: y - 34, alpha: 0, delay: 1100, duration: 700, ease: 'Cubic.easeIn', onComplete: () => c.destroy() });
    }

    // ---------- loop ----------

    update() {
      const now = this.time.now;
      for (const a of this.others.values()) this.bob(a, now);
      const self = this.self;
      if (!self || !cfg.interactive) return;
      const body = self.c.body as import('phaser').Physics.Arcade.Body;
      const speed = 210;
      let vx = 0;
      let vy = 0;
      const typing = typeof document !== 'undefined' && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '');
      if (!typing) {
        const k = this.keys;
        if (k.A?.isDown || k.LEFT?.isDown) vx -= 1;
        if (k.D?.isDown || k.RIGHT?.isDown) vx += 1;
        if (k.W?.isDown || k.UP?.isDown) vy -= 1;
        if (k.S?.isDown || k.DOWN?.isDown) vy += 1;
      }
      if (vx || vy) this.target = null;
      else if (this.target) {
        const dx = this.target.x - self.c.x;
        const dy = this.target.y - self.c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) this.target = null;
        else {
          vx = dx / dist;
          vy = dy / dist;
        }
      }
      const len = Math.hypot(vx, vy) || 1;
      body.setVelocity((vx / len) * speed, (vy / len) * speed);
      const moving = !!(vx || vy);
      self.moving = moving;
      this.bob(self, now);
      if (moving) {
        const dir: Dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
        if (dir !== self.dir) this.look(self, dir);
        if (this.target && body.blocked.none === false) this.target = null;
      }
      self.c.setDepth(10 + self.c.y / 1000);

      const changed = Math.abs(self.c.x - this.lastPos.x) > 1 || Math.abs(self.c.y - this.lastPos.y) > 1 || moving !== this.lastPos.moving;
      if (changed && now - this.lastSent > 60) {
        this.lastSent = now;
        this.lastPos = { x: self.c.x, y: self.c.y, moving };
        cfg.onMove(Math.round(self.c.x), Math.round(self.c.y), self.dir, moving);
      }
      const zone = cfg.map.zones.filter((z) => self.c.x >= z.x && self.c.x <= z.x + z.w && self.c.y >= z.y && self.c.y <= z.y + z.h).pop() ?? null;
      if ((zone?.id ?? null) !== this.zoneId) {
        this.zoneId = zone?.id ?? null;
        cfg.onZone(zone);
      }
    }

    // ---------- API used by React ----------

    private api(): SceneApi {
      return {
        setSelf: (p) => {
          this.self?.c.destroy();
          this.self = null;
          this.selfId = p?.userId ?? null;
          if (!p || p.spectator) {
            this.fitCamera();
            return;
          }
          const a = this.makeAvatar(p, true);
          a.c.setSize(28, 28);
          this.physics.add.existing(a.c);
          const body = a.c.body as import('phaser').Physics.Arcade.Body;
          body.setCircle(14);
          body.setCollideWorldBounds(true);
          this.physics.add.collider(a.c, this.solids);
          this.self = a;
          this.lastPos = { x: p.x, y: p.y, moving: false };
          this.fitCamera();
        },
        upsert: (p) => {
          if (p.userId === this.selfId) return;
          const existing = this.others.get(p.userId);
          if (p.spectator) {
            existing?.c.destroy();
            this.others.delete(p.userId);
            return;
          }
          if (existing) {
            existing.c.setPosition(p.x, p.y);
            return;
          }
          const a = this.makeAvatar(p, false);
          a.c.setScale(0.2);
          this.tweens.add({ targets: a.c, scale: 1, duration: 350, ease: 'Back.easeOut' });
          this.others.set(p.userId, a);
        },
        move: (id, x, y, dir, moving) => {
          const a = this.others.get(id);
          if (!a) return;
          a.tween?.stop();
          a.tween = this.tweens.add({ targets: a.c, x, y, duration: 110, ease: 'Linear', onUpdate: () => a.c.setDepth(10 + a.c.y / 1000) });
          if (dir !== a.dir) this.look(a, dir);
          a.moving = moving;
        },
        remove: (id) => {
          const a = this.others.get(id);
          if (!a) return;
          this.others.delete(id);
          this.tweens.add({ targets: a.c, scale: 0, alpha: 0, duration: 250, onComplete: () => a.c.destroy() });
        },
        clearOthers: () => {
          for (const a of this.others.values()) a.c.destroy();
          this.others.clear();
        },
        emote: (id, emoji) => {
          const a = id === this.selfId ? this.self : this.others.get(id);
          if (!a) return;
          this.bubble(a.c.x, a.c.y - 30, emoji);
          this.tweens.add({ targets: a.figure, scale: { from: 1, to: 1.18 }, duration: 160, yoyo: true, repeat: 1 });
        },
        speaking: (id, on) => {
          const a = id === this.selfId ? this.self : this.others.get(id);
          a?.ring.setVisible(on);
        },
        positions: () => {
          const m = new Map<string, { x: number; y: number }>();
          for (const [id, a] of this.others) m.set(id, { x: a.c.x, y: a.c.y });
          return m;
        },
        selfPos: () => (this.self ? { x: this.self.c.x, y: this.self.c.y } : null),
        teleport: (x, y) => {
          const self = this.self;
          if (!self) return;
          this.target = null;
          (self.c.body as import('phaser').Physics.Arcade.Body).reset(x, y);
          self.c.setPosition(x, y);
          this.look(self, 'down');
          this.lastPos = { x, y, moving: false };
          cfg.onMove(Math.round(x), Math.round(y), 'down', false);
          const pop = this.add.circle(x, y, 26, BRAND.cedar, 0.35).setDepth(9);
          this.tweens.add({ targets: pop, scale: { from: 0.4, to: 1.8 }, alpha: 0, duration: 420, onComplete: () => pop.destroy() });
        },
        setRooms: (views) => {
          const seen = new Set<number>();
          for (const v of views) {
            seen.add(v.roomIndex);
            let o = this.rooms.get(v.roomIndex);
            if (!o) {
              o = this.roomOverlay(v);
              this.rooms.set(v.roomIndex, o);
            }
            this.updateRoom(o, v);
          }
          for (const [idx, o] of this.rooms) {
            if (seen.has(idx)) continue;
            for (const obj of [o.frame, o.title.c, o.caption.c, o.emoji, o.headset]) obj.destroy();
            o.puppet?.c.destroy();
            this.rooms.delete(idx);
          }
        },
      };
    }
  };
}
