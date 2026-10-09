import { CAMPUS_MAP, STUDY_ROOM_MAP, clampToMap, distance, examHallMap, hallRooms, inRect, parseRoom, pickSpawn, roomKey, voiceGain, zoneAt, avatarColor } from './campus';
import { attemptEndsAt, createExamBody, effectiveExamStatus, finalExamScore, questionCountFor } from './exam';

describe('exam hall', () => {
  it('lays out one room per student without overlaps, in room order', () => {
    const rooms = hallRooms([3, 1, 2, 5, 4, 6, 7, 8, 9, 10]);
    expect(rooms.map((r) => r.roomIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const a of rooms)
      for (const b of rooms) {
        if (a === b) continue;
        const overlap = a.zone.x < b.zone.x + b.zone.w && b.zone.x < a.zone.x + a.zone.w && a.zone.y < b.zone.y + b.zone.h && b.zone.y < a.zone.y + a.zone.h;
        expect(overlap).toBe(false);
      }
  });
  it('every room is inside the map; seats and entries are inside their room', () => {
    const map = examHallMap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    expect(map.id).toBe('hall');
    for (const r of hallRooms([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30])) {
      expect(r.zone.x + r.zone.w).toBeLessThan(map.width);
      expect(r.zone.y + r.zone.h).toBeLessThan(map.height);
      expect(inRect(r.zone, r.entry.x, r.entry.y)).toBe(true);
      expect(inRect(r.zone, r.seat.x, r.seat.y)).toBe(true);
      expect(zoneAt(map, r.entry.x, r.entry.y)?.id).toBe(`room-${r.roomIndex}`);
    }
    // the corridor spawn is outside every room
    expect(zoneAt(map, map.spawns[0].x, map.spawns[0].y)).toBeNull();
  });
  it('works for a single student and parses hall rooms', () => {
    expect(examHallMap([1]).zones).toHaveLength(1);
    expect(examHallMap([]).zones).toHaveLength(0);
    expect(parseRoom('hall:exam1')).toEqual({ kind: 'hall', id: 'exam1' });
    expect(roomKey({ kind: 'hall', id: 'exam1' })).toBe('hall:exam1');
  });
});

describe('campus map helpers', () => {
  it('finds doors before the lobby', () => {
    expect(zoneAt(CAMPUS_MAP, 550, 260)?.kind).toBe('study_door');
    expect(zoneAt(CAMPUS_MAP, 1040, 260)?.kind).toBe('exam_door');
    expect(zoneAt(CAMPUS_MAP, 800, 300)?.kind).toBe('lobby');
    expect(zoneAt(CAMPUS_MAP, 30, 30)).toBeNull();
    // standing in front of Arzino (below its body) beats the lobby
    expect(zoneAt(CAMPUS_MAP, 800, 260)?.kind).toBe('npc');
  });
  it('clamps positions into the map (anti-teleport outside walls, NaN safe)', () => {
    expect(clampToMap(STUDY_ROOM_MAP, -500, 99999)).toEqual({ x: 30, y: STUDY_ROOM_MAP.height - 30 });
    expect(clampToMap(STUDY_ROOM_MAP, Number.NaN, 100)).toEqual({ x: STUDY_ROOM_MAP.spawns[0].x, y: 100 });
  });
  it('parses and builds room keys', () => {
    expect(parseRoom('campus')).toEqual({ kind: 'campus' });
    expect(parseRoom('study:abc')).toEqual({ kind: 'study', id: 'abc' });
    expect(parseRoom('exam:x_1')).toEqual({ kind: 'exam', id: 'x_1' });
    expect(parseRoom('admin:1')).toBeNull();
    expect(parseRoom('study:../../x')).toBeNull();
    expect(roomKey({ kind: 'campus' }, 's1')).toBe('campus:s1');
    expect(roomKey({ kind: 'exam', id: 'a' })).toBe('exam:a');
  });
  it('fades voice with distance', () => {
    expect(voiceGain(50)).toBe(1);
    expect(voiceGain(1000)).toBe(0.25);
    const mid = voiceGain(320);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0.25);
  });
  it('gives stable avatar colors', () => expect(avatarColor('lea')).toBe(avatarColor('lea')));
  it('picks a free spawn so avatars never stack', () => {
    const [s0, s1] = CAMPUS_MAP.spawns;
    expect(pickSpawn(CAMPUS_MAP, 0, [])).toEqual(s0);
    expect(pickSpawn(CAMPUS_MAP, 0, [s0])).toEqual(s1);
    expect(pickSpawn(CAMPUS_MAP, 1, [{ x: s1.x + 10, y: s1.y }])).toEqual(CAMPUS_MAP.spawns[2]);
    // everyone taken → nudged away from the preferred spawn, still inside the map
    const crowd = CAMPUS_MAP.spawns.map((s) => ({ ...s }));
    const p = pickSpawn(CAMPUS_MAP, 0, crowd);
    expect(distance(p, s0)).toBeGreaterThan(10);
    expect(clampToMap(CAMPUS_MAP, p.x, p.y)).toEqual(p);
  });
});

describe('exam helpers', () => {
  it('sizes the interview to the time', () => {
    expect(questionCountFor(10)).toBe(7);
    expect(questionCountFor(3)).toBe(3);
    expect(questionCountFor(1)).toBe(3);
    expect(questionCountFor(60)).toBe(12);
  });
  it('ends the attempt at duration or at the window close, whichever is first', () => {
    const start = new Date('2026-10-09T10:00:00Z');
    expect(attemptEndsAt(start, 10, new Date('2026-10-09T12:00:00Z')).toISOString()).toBe('2026-10-09T10:10:00.000Z');
    expect(attemptEndsAt(start, 10, new Date('2026-10-09T10:04:00Z')).toISOString()).toBe('2026-10-09T10:04:00.000Z');
  });
  it('computes the effective status from the window', () => {
    const e = { status: 'SCHEDULED' as const, opensAt: new Date(1000), closesAt: new Date(2000) };
    expect(effectiveExamStatus(e, new Date(500))).toBe('SCHEDULED');
    expect(effectiveExamStatus(e, new Date(1500))).toBe('OPEN');
    expect(effectiveExamStatus(e, new Date(2500))).toBe('CLOSED');
    expect(effectiveExamStatus({ ...e, status: 'READY' }, new Date(1500))).toBe('READY');
  });
  it('teacher score wins', () => {
    expect(finalExamScore({ aiScore: 60, teacherScore: 80 })).toBe(80);
    expect(finalExamScore({ aiScore: 60, teacherScore: null })).toBe(60);
  });
  it('rejects an exam that closes before it opens', () => {
    const r = createExamBody.safeParse({ classId: 'c', lessonIds: ['l'], title: 'Quiz', durationMin: 10, opensAt: '2026-10-09T10:00:00Z', closesAt: '2026-10-09T09:00:00Z' });
    expect(r.success).toBe(false);
  });
});
