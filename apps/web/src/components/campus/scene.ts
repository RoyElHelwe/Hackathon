import { avatarColor, type CampusMap, type Furniture, type PlayerState, type Zone } from '@tajriba/shared';

type PhaserNS = typeof import('phaser');
type Container = import('phaser').GameObjects.Container;
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

interface RoomOverlay {
  frame: import('phaser').GameObjects.Rectangle;
  title: import('phaser').GameObjects.Text;
  caption: import('phaser').GameObjects.Text;
  emoji: import('phaser').GameObjects.Text;
  headset: import('phaser').GameObjects.Text;
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
}

const FLOORS: Record<string, [number, number]> = {
  mint: [0xe9fbf4, 0x173a33],
  sunny: [0xfff6df, 0x3a3018],
  sky: [0xe8f5ff, 0x16304a],
  violet: [0xf1edff, 0x241d4a],
  coral: [0xfff0eb, 0x3d2219],
};
const C = {
  wall: 0x3b3561,
  wallDark: 0x0c0a1d,
  wood: 0xd4a77a,
  woodDark: 0x9c6f45,
  coral: 0xff7a59,
  mint: 0x2dd4a7,
  sky: 0x4cb8ff,
  sunny: 0xffc83d,
  violet: 0x6c4cf1,
  green: 0x5cc45c,
  greenDark: 0x3c9a3c,
  ink: 0x14112b,
  white: 0xffffff,
};

const hex = (c: string) => Number.parseInt(c.replace('#', ''), 16);
const FONT = 'Nunito, Tajawal, system-ui, sans-serif';

interface Avatar {
  c: Container;
  body: import('phaser').GameObjects.Arc;
  pupils: import('phaser').GameObjects.Arc[];
  ring: import('phaser').GameObjects.Arc;
  tween?: import('phaser').Tweens.Tween;
  dir: Dir;
}

/** Builds the Phaser scene class for one campus map (courtyard, study room or exam room). */
export function createCampusScene(Phaser: PhaserNS, cfg: SceneConfig) {
  const tr = (label: string) => cfg.translate?.(label) ?? label;
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

    create() {
      const { map } = cfg;
      const [light, dark] = FLOORS[map.floor] ?? FLOORS.violet;
      this.cameras.main.setBackgroundColor(cfg.dark ? 0x0b0920 : 0xdcd6f7);
      this.physics.world.setBounds(0, 0, map.width, map.height);

      // floor + soft grid
      const g = this.add.graphics();
      g.fillStyle(cfg.dark ? dark : light, 1).fillRect(0, 0, map.width, map.height);
      g.lineStyle(1, cfg.dark ? 0xffffff : C.ink, 0.05);
      for (let x = 0; x <= map.width; x += 40) g.lineBetween(x, 0, x, map.height);
      for (let y = 0; y <= map.height; y += 40) g.lineBetween(0, y, map.width, y);

      this.solids = this.physics.add.staticGroup();
      for (const z of map.zones) this.drawZone(z);
      for (const f of map.furniture) this.drawFurniture(f);
      for (const w of map.walls) {
        const glass = map.id === 'hall' && (w.w === 8 || w.h === 8);
        if (glass) this.add.rectangle(w.x + w.w / 2, w.y + w.h / 2, w.w, w.h, cfg.dark ? 0x5fb6f0 : 0x9fd8ff, 0.85).setStrokeStyle(1, C.sky, 1).setDepth(2);
        else this.add.rectangle(w.x + w.w / 2, w.y + w.h / 2, w.w, w.h, cfg.dark ? 0x2d2850 : C.wall).setDepth(2);
        this.solid(w.x, w.y, w.w, w.h);
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

    // ---------- drawing ----------

    private solid(x: number, y: number, w: number, h: number) {
      const r = this.add.rectangle(x + w / 2, y + h / 2, w, h);
      r.setVisible(false);
      this.solids.add(r);
    }

    private label(x: number, y: number, text: string, size = 13, color = '#14112b', bg?: string) {
      return this.add
        .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, backgroundColor: bg, padding: bg ? { x: 6, y: 2 } : undefined })
        .setOrigin(0.5)
        .setResolution(2);
    }

    private drawZone(z: Zone) {
      const door = z.kind === 'study_door' || z.kind === 'exam_door';
      if (!door && z.kind !== 'exam_desk' && z.kind !== 'stage') return;
      const color = z.kind === 'exam_door' || z.kind === 'exam_desk' ? C.sky : z.kind === 'stage' ? C.sunny : C.mint;
      const r = this.add.rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, color, 0.22).setStrokeStyle(2, color, 0.9).setDepth(1);
      if (door) {
        this.tweens.add({ targets: r, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
        this.label(z.x + z.w / 2, z.y - 12, `🚪 ${tr(z.label)}`, 13, '#ffffff', z.kind === 'exam_door' ? '#2b8fd6' : '#1aa884').setDepth(6);
      }
    }

    private drawFurniture(f: Furniture) {
      const g = this.add.graphics().setDepth(f.kind === 'rug' ? 0.5 : 3);
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      switch (f.kind) {
        case 'rug':
          g.fillStyle(C.violet, cfg.dark ? 0.18 : 0.09).fillRoundedRect(f.x, f.y, f.w, f.h, 24);
          g.lineStyle(2, C.violet, 0.18).strokeRoundedRect(f.x, f.y, f.w, f.h, 24);
          if (f.label) this.label(cx, f.y + 16, tr(f.label), 14, cfg.dark ? '#cfc6ff' : '#6c4cf1').setDepth(1);
          break;
        case 'table':
        case 'desk':
        case 'bench':
          g.fillStyle(0x000000, 0.12).fillRoundedRect(f.x + 3, f.y + 5, f.w, f.h, 10);
          g.fillStyle(C.wood, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 10);
          g.lineStyle(3, C.woodDark, 1).strokeRoundedRect(f.x, f.y, f.w, f.h, 10);
          if (f.kind === 'desk') g.fillStyle(C.sky, 0.9).fillRoundedRect(cx - 14, f.y + 8, 28, 18, 3);
          break;
        case 'sofa':
          g.fillStyle(C.coral, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 14);
          g.fillStyle(0xffffff, 0.25).fillRoundedRect(f.x + 6, f.y + 6, f.w - 12, f.h - 12, 10);
          break;
        case 'shelf': {
          g.fillStyle(C.woodDark, 1).fillRect(f.x, f.y, f.w, f.h);
          const books = [C.coral, C.sky, C.sunny, C.mint, C.violet];
          for (let i = 0; i < Math.floor(f.w / 14); i++) g.fillStyle(books[i % books.length], 1).fillRect(f.x + 4 + i * 14, f.y + 5, 10, f.h - 10);
          break;
        }
        case 'plant':
          g.fillStyle(C.woodDark, 1).fillCircle(cx, cy + 6, f.w / 3);
          g.fillStyle(C.green, 1).fillCircle(cx, cy - 2, f.w / 2.3);
          g.fillStyle(C.greenDark, 1).fillCircle(cx - 5, cy - 6, f.w / 5);
          break;
        case 'tree':
          g.fillStyle(0x000000, 0.12).fillEllipse(cx + 6, cy + f.h / 2 - 4, f.w, f.h / 3);
          g.fillStyle(C.greenDark, 1).fillCircle(cx, cy, f.w / 2);
          g.fillStyle(C.green, 1).fillCircle(cx - 6, cy - 6, f.w / 2.6);
          break;
        case 'fountain':
          g.fillStyle(0xb9c4d6, 1).fillCircle(cx, cy, f.w / 2);
          g.fillStyle(C.sky, 1).fillCircle(cx, cy, f.w / 2 - 10);
          g.fillStyle(0xffffff, 0.8).fillCircle(cx, cy, 10);
          this.tweens.add({ targets: g, alpha: { from: 0.9, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });
          break;
        case 'board':
          g.fillStyle(0x1f5f4a, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 8);
          g.lineStyle(4, C.woodDark, 1).strokeRoundedRect(f.x, f.y, f.w, f.h, 8);
          if (f.label) this.label(cx, cy, tr(f.label), 15, '#ffffff').setDepth(4);
          break;
        case 'lamp':
          g.fillStyle(C.sunny, 0.25).fillCircle(cx, cy, f.w);
          g.fillStyle(C.sunny, 1).fillCircle(cx, cy, f.w / 2.5);
          break;
        case 'bousla': {
          // Bousla, the compass mascot, standing in the room.
          g.fillStyle(0x000000, 0.12).fillEllipse(cx, f.y + f.h + 2, f.w * 0.8, 10);
          g.fillStyle(C.violet, 1).fillCircle(cx, cy, f.w / 2);
          g.fillStyle(0xffffff, 1).fillCircle(cx, cy, f.w / 2 - 7);
          g.fillStyle(C.coral, 1).fillTriangle(cx, cy - f.h / 2 + 10, cx - 5, cy, cx + 5, cy);
          g.fillStyle(C.ink, 1).fillCircle(cx - 9, cy + 4, 3).fillCircle(cx + 9, cy + 4, 3);
          this.tweens.add({ targets: g, y: { from: 0, to: -4 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          break;
        }
      }
      if (f.solid) this.solid(f.x, f.y, f.w, f.h);
    }

    private makeAvatar(p: PlayerState, isSelf: boolean): Avatar {
      const color = hex(p.color);
      const shadow = this.add.ellipse(0, 16, 30, 9, 0x000000, 0.18);
      const ring = this.add.circle(0, 0, 21).setStrokeStyle(3, C.mint, 1).setVisible(false);
      const body = this.add.circle(0, 0, 15, color).setStrokeStyle(3, 0xffffff, 0.95);
      const eyeL = this.add.circle(-5, -3, 4.2, 0xffffff);
      const eyeR = this.add.circle(5, -3, 4.2, 0xffffff);
      const pupilL = this.add.circle(-5, -2, 2, C.ink);
      const pupilR = this.add.circle(5, -2, 2, C.ink);
      const name = this.label(0, 29, isSelf ? `${p.name} ★` : p.name, 12, '#ffffff', isSelf ? '#6c4cf1' : '#14112bcc');
      const c = this.add.container(p.x, p.y, [shadow, ring, body, eyeL, eyeR, pupilL, pupilR, name]).setDepth(10 + p.y / 1000);
      this.tweens.add({ targets: ring, scale: { from: 0.95, to: 1.15 }, duration: 450, yoyo: true, repeat: -1 });
      return { c, body, pupils: [pupilL, pupilR], ring, dir: p.dir };
    }

    private look(a: Avatar, dir: Dir) {
      a.dir = dir;
      const d = { up: [0, -2.2], down: [0, 1.4], left: [-2, 0], right: [2, 0] }[dir];
      a.pupils[0].setPosition(-5 + d[0], -2 + d[1]);
      a.pupils[1].setPosition(5 + d[0], -2 + d[1]);
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
        cam.setZoom(map.id === 'hall' ? Math.max(0.5, Math.min(1.2, cover)) : Math.max(0.6, Math.min(1, fit * 1.6)));
        cam.setBounds(0, 0, map.width, map.height);
        if (this.self) cam.startFollow(this.self.c, true, 0.15, 0.15);
      }
    }

    // ---------- Exam Hall overlays ----------

    private roomOverlay(v: HallRoomView): RoomOverlay {
      const z = v.zone;
      const frame = this.add.rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, C.sky, 0.08).setStrokeStyle(4, C.violet, 0).setDepth(0.6);
      const title = this.label(z.x + 10, z.y + 20, '', 13, cfg.dark ? '#ffffff' : '#14112b').setOrigin(0, 0.5).setDepth(6);
      const caption = this.label(z.x + z.w - 10, z.y + 20, '', 12, '#ffffff', '#2b8fd6').setOrigin(1, 0.5).setDepth(6);
      const emoji = this.add.text(v.seat.x + 26, v.seat.y - 30, '', { fontSize: '26px' }).setOrigin(0.5).setDepth(12);
      const headset = this.add.text(z.x + z.w - 18, z.y + z.h - 18, '🎧', { fontSize: '20px' }).setOrigin(0.5).setDepth(12).setVisible(false);
      this.tweens.add({ targets: emoji, y: emoji.y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return { frame, title, caption, emoji, headset, puppet: null, key: '' };
    }

    private updateRoom(o: RoomOverlay, v: HallRoomView) {
      const tint = { live: C.sky, waiting: 0x9a96b8, done: C.mint, missed: C.coral }[v.state];
      o.frame.setFillStyle(tint, v.state === 'live' ? 0.12 : 0.07);
      o.frame.setStrokeStyle(4, C.violet, v.focused ? 1 : 0);
      o.title.setText(`#${v.roomIndex} ${v.name}`);
      o.caption.setText(v.caption).setVisible(!!v.caption);
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

    // ---------- loop ----------

    update() {
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
      if (moving) {
        const dir: Dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
        if (dir !== self.dir) this.look(self, dir);
        if (this.target && body.blocked.none === false) this.target = null;
      }
      self.c.setDepth(10 + self.c.y / 1000);

      const now = this.time.now;
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
          void moving;
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
          const t = this.add.text(a.c.x, a.c.y - 34, emoji, { fontSize: '30px' }).setOrigin(0.5).setDepth(50);
          this.tweens.add({ targets: t, y: t.y - 46, alpha: { from: 1, to: 0 }, scale: { from: 0.6, to: 1.3 }, duration: 1700, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
          this.tweens.add({ targets: a.body, scale: { from: 1, to: 1.18 }, duration: 160, yoyo: true, repeat: 1 });
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
          const pop = this.add.circle(x, y, 26, C.violet, 0.35).setDepth(9);
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
            for (const obj of [o.frame, o.title, o.caption, o.emoji, o.headset]) obj.destroy();
            o.puppet?.c.destroy();
            this.rooms.delete(idx);
          }
        },
      };
    }
  };
}
