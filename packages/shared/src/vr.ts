import { CampusMap, clampToMap, Rect } from './campus';

// ---------- VR: the 2D campus maps in meters (Quest headset in the same rooms as laptop players) ----------

/** 40 map pixels = 1 meter: a 1600 × 1000 courtyard becomes 40 m × 25 m, an avatar (r 14 px) is ~0.35 m wide. */
export const PX_PER_METER = 40;
export const METERS_PER_PX = 1 / PX_PER_METER;
/** collision radius of a player, in map pixels (same body as the Phaser avatar) */
export const PLAYER_RADIUS_PX = 14;

/** Map pixels → world meters (map y runs along world z). */
export function toWorld(x: number, y: number): { x: number; z: number } {
  return { x: x * METERS_PER_PX, z: y * METERS_PER_PX };
}

/** World meters → map pixels (rounded like the server does). */
export function toMap(x: number, z: number): { x: number; y: number } {
  return { x: Math.round(x * PX_PER_METER), y: Math.round(z * PX_PER_METER) };
}

/** Walls and solid furniture: what a player can't walk through. */
export function solids(map: CampusMap): Rect[] {
  return [...map.walls, ...map.furniture.filter((f) => f.solid)];
}

function circleHitsRect(x: number, y: number, r: number, b: Rect): boolean {
  const nx = Math.max(b.x, Math.min(x, b.x + b.w));
  const ny = Math.max(b.y, Math.min(y, b.y + b.h));
  return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
}

/** Would a player standing at (x, y) overlap a wall or solid furniture? */
export function blockedBy(map: CampusMap, x: number, y: number, r = PLAYER_RADIUS_PX): boolean {
  return solids(map).some((b) => circleHitsRect(x, y, r, b));
}

/**
 * One step of walking from `from` toward `to` (map pixels). Blocked steps slide along the obstacle (x only, then
 * y only) like the Phaser arcade body does, so VR and laptop players move through the rooms the same way.
 */
export function slide(map: CampusMap, from: { x: number; y: number }, to: { x: number; y: number }, r = PLAYER_RADIUS_PX): { x: number; y: number } {
  const tryAt = (x: number, y: number) => (blockedBy(map, x, y, r) ? null : clampToMap(map, x, y));
  return tryAt(to.x, to.y) ?? tryAt(to.x, from.y) ?? tryAt(from.x, to.y) ?? { x: from.x, y: from.y };
}

// ---------- Shadow Lab: similar triangles with the sun ----------

/** Lowest and highest sun in the lab (degrees above the horizon). */
export const SUN_MIN_DEG = 20;
export const SUN_MAX_DEG = 70;

/** Slider/drag position 0..1 → sun elevation in degrees. */
export function sunElevationFor(t: number): number {
  const c = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  return SUN_MIN_DEG + (SUN_MAX_DEG - SUN_MIN_DEG) * c;
}

/** Length of the shadow of something `height` tall when the sun is `elevationDeg` above the horizon. */
export function shadowLength(height: number, elevationDeg: number): number {
  return height / Math.tan((elevationDeg * Math.PI) / 180);
}

/** Similar triangles: h / s = H / S → H = h · S / s. */
export function heightFromShadows(h: number, s: number, S: number): number {
  if (!(s > 0)) throw new Error('shadow length must be positive');
  return (h * S) / s;
}

/** Three answer choices for "how tall is the building?": the right one and two believable wrong ones, shuffled. */
export function heightChoices(H: number, seed = 0): number[] {
  const round = (v: number) => Math.round(v * 10) / 10;
  const opts = [round(H), round(H * 1.5), round(H * 0.6)];
  const k = Math.abs(Math.floor(seed)) % 3;
  return [...opts.slice(k), ...opts.slice(0, k)];
}
