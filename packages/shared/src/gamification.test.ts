import {
  applyActivity,
  dayKey,
  earnedBadges,
  finalScore,
  levelForXp,
  levelInfo,
  missionXp,
  xpForLevel,
} from './gamification';

describe('levels', () => {
  it('xpForLevel matches the spec', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });
  it('levelForXp', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
    expect(levelForXp(1000)).toBe(5);
  });
  it('levelInfo progress', () => {
    const i = levelInfo(200);
    expect(i.level).toBe(2);
    expect(i.progress).toBeCloseTo(0.5);
  });
});

describe('mission XP', () => {
  it('medium first try with follow-up', () => {
    const awards = missionXp({ difficulty: 'MEDIUM', attempt: 1, followUpUnderstood: true, family: false });
    expect(awards.reduce((s, a) => s + a.amount, 0)).toBe(70);
  });
  it('hard second try', () => {
    expect(missionXp({ difficulty: 'HARD', attempt: 2, followUpUnderstood: false, family: false })).toEqual([
      { reason: 'MISSION_VALIDATED', amount: 80 },
    ]);
  });
  it('family mission bonus', () => {
    const total = missionXp({ difficulty: 'EASY', attempt: 1, followUpUnderstood: false, family: true }).reduce((s, a) => s + a.amount, 0);
    expect(total).toBe(30 + 10 + 20);
  });
});

describe('streaks (Asia/Beirut)', () => {
  it('dayKey uses Beirut time: 22:30 UTC is already the next day in Beirut (UTC+3 in October)', () => {
    expect(dayKey(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09');
    expect(dayKey(new Date('2026-10-08T20:59:00Z'))).toBe('2026-10-08');
  });

  it('starts a streak', () => {
    const r = applyActivity({ current: 0, longest: 0, lastActive: null }, new Date('2026-10-08T10:00:00Z'));
    expect(r.current).toBe(1);
    expect(r.changed).toBe(true);
  });

  it('same day does not increase', () => {
    const r = applyActivity({ current: 2, longest: 2, lastActive: new Date('2026-10-08T06:00:00Z') }, new Date('2026-10-08T18:00:00Z'));
    expect(r.current).toBe(2);
    expect(r.changed).toBe(false);
  });

  it('midnight edge: activity just before and just after Beirut midnight counts as consecutive days', () => {
    // 20:50 UTC = 23:50 Beirut on Oct 8; 21:10 UTC = 00:10 Beirut on Oct 9
    const r = applyActivity({ current: 1, longest: 1, lastActive: new Date('2026-10-08T20:50:00Z') }, new Date('2026-10-08T21:10:00Z'));
    expect(r.current).toBe(2);
  });

  it('reaching 3 days gives a milestone bonus', () => {
    const r = applyActivity({ current: 2, longest: 2, lastActive: new Date('2026-10-07T10:00:00Z') }, new Date('2026-10-08T10:00:00Z'));
    expect(r.current).toBe(3);
    expect(r.milestoneXp).toBe(15);
  });

  it('a missed day resets the streak but keeps longest', () => {
    const r = applyActivity({ current: 5, longest: 5, lastActive: new Date('2026-10-05T10:00:00Z') }, new Date('2026-10-08T10:00:00Z'));
    expect(r.current).toBe(1);
    expect(r.longest).toBe(5);
  });
});

describe('final score', () => {
  it('teacher wins', () => expect(finalScore({ teacher: 72, ai: 90, peer: 80 })).toBe(72));
  it('weighted AI + peer', () => expect(finalScore({ ai: 90, peer: 80 })).toBe(86));
  it('AI only (family path)', () => expect(finalScore({ ai: 77 })).toBe(77));
});

describe('badges', () => {
  const base = { validatedCount: 0, validatedTopicKeys: [], evaluationsDone: 0, helpfulRatingsReceived: 0, streakCurrent: 0, familyMissions: 0 };
  it('first mission + shadow hunter', () => {
    expect(earnedBadges({ ...base, validatedCount: 1, validatedTopicKeys: ['geo.similar'] }, [])).toEqual(['first_mission', 'shadow_hunter']);
  });
  it('does not re-award', () => {
    expect(earnedBadges({ ...base, validatedCount: 3 }, ['first_mission'])).toEqual([]);
  });
  it('architect needs 3 area/volume missions', () => {
    expect(earnedBadges({ ...base, validatedCount: 3, validatedTopicKeys: ['geo.area', 'geo.area', 'geo.volume'] }, ['first_mission'])).toEqual(['architect']);
  });
  it('peer hero, streak and family', () => {
    expect(earnedBadges({ ...base, evaluationsDone: 5, streakCurrent: 7, familyMissions: 2, helpfulRatingsReceived: 3 }, [])).toEqual([
      'peer_hero',
      'kind_reviewer',
      'streak_7',
      'family_team',
    ]);
  });
});
