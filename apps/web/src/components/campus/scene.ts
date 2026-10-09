import type { CampusMap, Furniture, PlayerState, Zone } from '@tajriba/shared';

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
  /** campus: Study Hall tables glow with "Lea & Karim" while their session is live (one label per table) */
  setLiveTables(labels: string[]): void;
  /** campus: the Exam Wing desks glow when the student has an exam room open */
  setExamGlow(on: boolean): void;
  /** walk my avatar to a point (same as tapping the floor there) */
  walkTo(x: number, y: number): void;
}

export interface SceneConfig {
  map: CampusMap;
  interactive: boolean;
  dark: boolean;
  onMove: (x: number, y: number, dir: Dir, moving: boolean) => void;
  onZone: (zone: Zone | null) => void;
  onReady: (api: SceneApi) => void;
  /** tapped another player's avatar */
  onPlayerTap?: (userId: string) => void;
  /** the closest other player within reach changed (null = nobody close) */
  onNear?: (userId: string | null) => void;
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
  /** body + eyes: bobs while walking */
  figure: Container;
  body: import('phaser').GameObjects.Arc;
  pupils: import('phaser').GameObjects.Arc[];
  ring: import('phaser').GameObjects.Arc;
  tween?: import('phaser').Tweens.Tween;
  bob?: import('phaser').Tweens.Tween;
  /** scene time of the last movement update (remote players) */
  lastMove: number;
  dir: Dir;
}

/** a remote player with no movement update for this long has stopped (the "stopped" packet may be dropped) */
const IDLE_AFTER_MS = 350;
/** how close another player must be for the "say hi / invite" prompt */
const NEAR_PX = 80;

type Glow = { box: import('phaser').GameObjects.Rectangle; label?: import('phaser').GameObjects.Text };

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
    /** tap-to-move: best distance to the target so far, and when it last improved (gives up when stuck) */
    private progress = { best: Infinity, at: 0 };
    private lastSent = 0;
    private lastPos = { x: 0, y: 0, moving: false };
    private zoneId: string | null = null;
    private nearId: string | null = null;
    private needle: { g: import('phaser').GameObjects.Graphics; cx: number; cy: number } | null = null;
    private tables: Glow[] = [];
    private desks: Glow[] = [];

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
        this.add.rectangle(w.x + w.w / 2, w.y + w.h / 2, w.w, w.h, cfg.dark ? 0x2d2850 : C.wall).setDepth(2);
        this.solid(w.x, w.y, w.w, w.h);
      }
      if (map.id === 'campus') {
        this.tables = map.furniture.filter((f) => f.kind === 'table').map((f) => this.makeGlow(f, C.mint, true));
        this.desks = map.furniture.filter((f) => f.kind === 'desk').map((f) => this.makeGlow(f, C.sky, false));
      }

      if (cfg.interactive && this.input.keyboard) {
        // No key capture: typing in inputs/textareas elsewhere on the page must keep working.
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as Record<string, import('phaser').Input.Keyboard.Key>;
        this.input.on('pointerdown', (p: import('phaser').Input.Pointer, over: unknown[]) => {
          if (over?.length) return; // tapped an avatar: open its card, don't walk there
          this.setTarget(p.worldX, p.worldY);
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

    /** A pulsing highlight around a piece of furniture, hidden until switched on. */
    private makeGlow(f: Furniture, color: number, withLabel: boolean): Glow {
      const box = this.add
        .rectangle(f.x + f.w / 2, f.y + f.h / 2, f.w + 18, f.h + 18, color, 0.2)
        .setStrokeStyle(3, color, 1)
        .setDepth(2.9)
        .setVisible(false);
      this.tweens.add({ targets: box, alpha: { from: 0.45, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
      // never empty: a zero-size text texture breaks WebGL framebuffers
      const label = withLabel ? this.label(f.x + f.w / 2, f.y - 16, ' ', 12, '#ffffff', '#1aa884').setDepth(7).setVisible(false) : undefined;
      return { box, label };
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
        case 'fountain': {
          // stone basin, water, a centre spout and ripples spreading out (reads as water, not as a button)
          const r = f.w / 2;
          g.fillStyle(0x000000, 0.12).fillEllipse(cx + 5, cy + 8, f.w, f.h * 0.92);
          g.fillStyle(cfg.dark ? 0x58617a : 0xd5dbe6, 1).fillCircle(cx, cy, r);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            g.fillStyle(cfg.dark ? 0x4a5269 : 0xbfc7d6, 1).fillCircle(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), 4);
          }
          g.fillStyle(cfg.dark ? 0x2b6f9c : 0x8fd6ff, 1).fillCircle(cx, cy, r - 11);
          g.fillStyle(0xffffff, 0.35).fillEllipse(cx - r / 3, cy - r / 3, r / 2, r / 4);
          g.fillStyle(cfg.dark ? 0x58617a : 0xd5dbe6, 1).fillCircle(cx, cy, 11);
          g.fillStyle(0xffffff, 0.95).fillCircle(cx, cy - 2, 5);
          for (const delay of [0, 900]) {
            const ripple = this.add.circle(cx, cy, 12).setStrokeStyle(2, 0xffffff, 0.8).setDepth(3.1);
            this.tweens.add({ targets: ripple, scale: { from: 1, to: (r - 12) / 12 }, alpha: { from: 0.9, to: 0 }, duration: 1800, delay, repeat: -1 });
          }
          break;
        }
        case 'board':
          g.fillStyle(0x1f5f4a, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 8);
          g.lineStyle(4, C.woodDark, 1).strokeRoundedRect(f.x, f.y, f.w, f.h, 8);
          if (f.label) this.label(cx, cy, tr(f.label), 15, '#ffffff').setDepth(4);
          break;
        case 'lamp': {
          // floor lamp seen from the front: base, pole, shade and a warm glow
          g.fillStyle(C.sunny, cfg.dark ? 0.2 : 0.14).fillCircle(cx, f.y + 10, f.w * 0.95);
          g.fillStyle(0x000000, 0.12).fillEllipse(cx + 2, f.y + f.h, f.w * 0.75, 8);
          g.fillStyle(C.woodDark, 1).fillEllipse(cx, f.y + f.h - 2, f.w * 0.6, 8);
          g.fillStyle(0x6b5a4a, 1).fillRect(cx - 2, f.y + 14, 4, f.h - 16);
          const shade = [
            { x: cx - 8, y: f.y },
            { x: cx + 8, y: f.y },
            { x: cx + 15, y: f.y + 16 },
            { x: cx - 15, y: f.y + 16 },
          ];
          g.fillStyle(0xfff1c1, 1).fillPoints(shade, true);
          g.lineStyle(2, C.sunny, 1).strokePoints(shade, true);
          g.fillStyle(0xffffff, 0.9).fillCircle(cx, f.y + 18, 3);
          break;
        }
        case 'bousla': {
          // Bousla, the compass mascot, standing in the room. Its needle is separate so it can turn toward you.
          g.fillStyle(0x000000, 0.12).fillEllipse(cx, f.y + f.h + 2, f.w * 0.8, 10);
          g.fillStyle(C.violet, 1).fillCircle(cx, cy, f.w / 2);
          g.fillStyle(0xffffff, 1).fillCircle(cx, cy, f.w / 2 - 7);
          g.fillStyle(C.ink, 1).fillCircle(cx - 9, cy + 4, 3).fillCircle(cx + 9, cy + 4, 3);
          const needle = this.add.graphics({ x: cx, y: cy }).setDepth(3.2);
          needle.fillStyle(C.coral, 1).fillTriangle(0, -f.h / 2 + 10, -5, 0, 5, 0);
          needle.fillStyle(C.ink, 0.25).fillTriangle(0, f.h / 2 - 16, -4, 0, 4, 0);
          needle.fillStyle(C.ink, 1).fillCircle(0, 0, 2.5);
          this.needle ??= { g: needle, cx, cy };
          this.tweens.add({ targets: [g, needle], y: '-=4', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
      const parts: import('phaser').GameObjects.GameObject[] = [body, eyeL, eyeR, pupilL, pupilR];
      if (p.role === 'TEACHER') {
        parts.push(this.add.text(13, 9, '🎓', { fontSize: '14px' }).setOrigin(0.5));
      } else if (p.level) {
        // level badge, like a game character
        parts.push(this.add.circle(13, 10, 8, C.sunny).setStrokeStyle(2, 0xffffff, 1));
        parts.push(this.add.text(13, 10, String(p.level), { fontFamily: FONT, fontSize: '10px', fontStyle: '900', color: '#14112b' }).setOrigin(0.5).setResolution(2));
      }
      const figure = this.add.container(0, 0, parts);
      if (!isSelf && cfg.interactive) {
        // tap a classmate → their card (say hi, invite to study)
        for (const t of [body, name]) {
          t.setInteractive({ useHandCursor: true });
          t.on('pointerdown', () => cfg.onPlayerTap?.(p.userId));
        }
      }
      const c = this.add.container(p.x, p.y, [shadow, ring, figure, name]).setDepth(10 + p.y / 1000);
      this.tweens.add({ targets: ring, scale: { from: 0.95, to: 1.15 }, duration: 450, yoyo: true, repeat: -1 });
      const a: Avatar = { c, figure, body, pupils: [pupilL, pupilR], ring, dir: p.dir, lastMove: 0 };
      if (p.moving) this.walk(a, true);
      return a;
    }

    private setTarget(x: number, y: number) {
      this.target = { x, y };
      this.progress = { best: Infinity, at: this.time.now };
    }

    /** A little hop while walking, so moving players don't just slide. */
    private walk(a: Avatar, on: boolean) {
      if (on && !a.bob) {
        a.bob = this.tweens.add({ targets: a.figure, y: { from: 0, to: -4 }, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else if (!on && a.bob) {
        a.bob.stop();
        a.bob = undefined;
        a.figure.y = 0;
      }
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
      if (map.id !== 'campus' || fit >= 0.9) {
        cam.stopFollow();
        cam.setZoom(Math.min(1.4, fit));
        cam.removeBounds();
        cam.centerOn(map.width / 2, map.height / 2);
      } else {
        cam.setZoom(Math.max(0.6, Math.min(1, fit * 1.6)));
        cam.setBounds(0, 0, map.width, map.height);
        if (this.self) cam.startFollow(this.self.c, true, 0.15, 0.15);
      }
    }

    // ---------- loop ----------

    update() {
      const now = this.time.now;
      for (const a of this.others.values()) if (a.bob && now - a.lastMove > IDLE_AFTER_MS) this.walk(a, false);
      this.turnNeedle(now);
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
        if (dist < this.progress.best - 2) this.progress = { best: dist, at: this.time.now };
        // arrived, or pressed against a wall/table without getting closer for a moment → stop
        if (dist < 6 || this.time.now - this.progress.at > 400) this.target = null;
        else {
          vx = dx / dist;
          vy = dy / dist;
        }
      }
      const len = Math.hypot(vx, vy) || 1;
      body.setVelocity((vx / len) * speed, (vy / len) * speed);
      const moving = !!(vx || vy);
      this.walk(self, moving);
      if (moving) {
        const dir: Dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
        if (dir !== self.dir) this.look(self, dir);
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
      let near: string | null = null;
      let best = NEAR_PX;
      for (const [id, a] of this.others) {
        const d = Math.hypot(a.c.x - self.c.x, a.c.y - self.c.y);
        if (d < best) {
          best = d;
          near = id;
        }
      }
      if (near !== this.nearId) {
        this.nearId = near;
        cfg.onNear?.(near);
      }
    }

    /** Bousla's needle wobbles, and points at you while you stand in front of it. */
    private turnNeedle(now: number) {
      const n = this.needle;
      if (!n) return;
      const self = this.self;
      const facing = self && cfg.map.zones.find((z) => z.id === this.zoneId)?.kind === 'npc';
      const target = facing ? Math.atan2(self.c.y - n.cy, self.c.x - n.cx) + Math.PI / 2 : Math.sin(now / 700) * 0.35;
      n.g.rotation += Phaser.Math.Angle.Wrap(target - n.g.rotation) * 0.15;
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
          // a bit longer than the 60 ms send interval, so the next update arrives before the tween ends
          a.tween = this.tweens.add({ targets: a.c, x, y, duration: 80, ease: 'Linear', onUpdate: () => a.c.setDepth(10 + a.c.y / 1000) });
          if (dir !== a.dir) this.look(a, dir);
          a.lastMove = this.time.now;
          this.walk(a, moving);
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
        setLiveTables: (labels) => {
          this.tables.forEach((t, i) => {
            const text = labels[i];
            t.box.setVisible(!!text);
            t.label?.setText(text || ' ').setVisible(!!text);
          });
        },
        setExamGlow: (on) => {
          for (const d of this.desks) d.box.setVisible(on);
        },
        walkTo: (x, y) => {
          if (cfg.interactive) this.setTarget(x, y);
        },
      };
    }
  };
}
