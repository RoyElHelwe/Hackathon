import { CAMPUS_MAP, STUDY_ROOM_MAP } from './campus';
import { blockedBy, heightChoices, heightFromShadows, shadowLength, slide, sunElevationFor, toMap, toWorld } from './vr';

describe('VR map ↔ world', () => {
  it('converts pixels to meters and back', () => {
    expect(toWorld(800, 400)).toEqual({ x: 20, z: 10 });
    expect(toMap(20, 10)).toEqual({ x: 800, y: 400 });
    expect(toMap(toWorld(123, 457).x, toWorld(123, 457).z)).toEqual({ x: 123, y: 457 });
  });

  it('knows walls and solid furniture', () => {
    expect(blockedBy(STUDY_ROOM_MAP, 5, 200)).toBe(true); // the left wall
    expect(blockedBy(STUDY_ROOM_MAP, 400, 280)).toBe(true); // the discussion table
    expect(blockedBy(STUDY_ROOM_MAP, 300, 440)).toBe(false); // a spawn point
    expect(blockedBy(CAMPUS_MAP, 800, 420)).toBe(false);
  });

  it('slides along obstacles instead of stopping', () => {
    // walking diagonally into the table's top edge keeps the sideways part of the move
    const from = { x: 300, y: 220 };
    const to = { x: 320, y: 250 };
    const p = slide(STUDY_ROOM_MAP, from, to);
    expect(p.x).toBe(320);
    expect(p.y).toBe(220);
    // free move goes through unchanged
    expect(slide(STUDY_ROOM_MAP, { x: 300, y: 440 }, { x: 310, y: 450 })).toEqual({ x: 310, y: 450 });
    // never out of the map
    const out = slide(STUDY_ROOM_MAP, { x: 40, y: 440 }, { x: -50, y: 440 });
    expect(out.x).toBeGreaterThanOrEqual(30);
  });
});

describe('Shadow Lab math', () => {
  it('casts longer shadows when the sun is low', () => {
    expect(shadowLength(1, 45)).toBeCloseTo(1, 6);
    expect(shadowLength(1.55, 30)).toBeCloseTo(2.6847, 3);
    expect(shadowLength(10, 20)).toBeGreaterThan(shadowLength(10, 60));
  });

  it('maps the drag position to the sun elevation (clamped)', () => {
    expect(sunElevationFor(0)).toBe(20);
    expect(sunElevationFor(1)).toBe(70);
    expect(sunElevationFor(5)).toBe(70);
    expect(sunElevationFor(Number.NaN)).toBe(20);
  });

  it('finds the building height with similar triangles', () => {
    const h = 1.55;
    const H = 18;
    for (const sun of [25, 40, 65]) {
      expect(heightFromShadows(h, shadowLength(h, sun), shadowLength(H, sun))).toBeCloseTo(H, 6);
    }
    expect(() => heightFromShadows(1.5, 0, 3)).toThrow();
  });

  it('offers the right answer among three choices', () => {
    const c = heightChoices(18.24, 2);
    expect(c).toHaveLength(3);
    expect(c).toContain(18.2);
    expect(new Set(c).size).toBe(3);
  });
});
