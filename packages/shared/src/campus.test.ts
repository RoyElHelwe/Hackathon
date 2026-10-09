import { CAMPUS_MAP, STUDY_ROOM_MAP, clampToMap, parseRoom, roomKey, voiceGain, zoneAt, avatarColor } from './campus';
import { attemptEndsAt, createExamBody, effectiveExamStatus, finalExamScore, questionCountFor } from './exam';

describe('campus map helpers', () => {
  it('finds doors before the lobby', () => {
    expect(zoneAt(CAMPUS_MAP, 550, 260)?.kind).toBe('study_door');
    expect(zoneAt(CAMPUS_MAP, 1040, 260)?.kind).toBe('exam_door');
    expect(zoneAt(CAMPUS_MAP, 800, 300)?.kind).toBe('lobby');
    expect(zoneAt(CAMPUS_MAP, 30, 30)).toBeNull();
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
