import { Actor, can, checkFamilyCode, isEligibleEvaluator, makeFamilyCode, makeSchoolCode, pickEvaluator, roleMayEver } from './permissions';
import { safetyPrefilter } from './safety';
import { stuckReasons, unlockedTopics } from './stuck';

const S = 'school1';
const director: Actor = { userId: 'd', role: 'DIRECTOR', schoolId: S };
const admin: Actor = { userId: 'a', role: 'ADMIN', schoolId: S };
const teacher: Actor = { userId: 't', role: 'TEACHER', schoolId: S, classIdsTaught: ['c1'] };
const student: Actor = { userId: 'lea', role: 'STUDENT', schoolId: S, classIdsEnrolled: ['c1'] };
const parent: Actor = { userId: 'mona', role: 'PARENT', schoolId: S, childIds: ['lea'], childClassIds: ['c1'] };

describe('permissions — school settings & members', () => {
  it('director/admin read & write', () => {
    for (const a of [director, admin]) {
      expect(can(a, 'read', 'members', { schoolId: S })).toBe(true);
      expect(can(a, 'write', 'school', { schoolId: S })).toBe(true);
    }
  });
  it('only director can delete the school', () => {
    expect(can(director, 'delete', 'school', { schoolId: S })).toBe(true);
    expect(can(admin, 'delete', 'school', { schoolId: S })).toBe(false);
  });
  it('teacher reads own membership only', () => {
    expect(can(teacher, 'read', 'members', { membershipUserId: 't' })).toBe(true);
    expect(can(teacher, 'read', 'members', { membershipUserId: 'other' })).toBe(false);
    expect(can(teacher, 'write', 'members', { membershipUserId: 't' })).toBe(false);
  });
  it('students and parents denied', () => {
    expect(can(student, 'read', 'members', { schoolId: S })).toBe(false);
    expect(can(parent, 'read', 'school', { schoolId: S })).toBe(false);
  });
  it('other school denied even for director', () => {
    expect(can(director, 'read', 'members', { schoolId: 'other' })).toBe(false);
  });
});

describe('permissions — class', () => {
  it('director all in school', () => expect(can(director, 'write', 'class', { classId: 'c9' })).toBe(true));
  it('teacher only classes they teach', () => {
    expect(can(teacher, 'write', 'class', { classId: 'c1' })).toBe(true);
    expect(can(teacher, 'read', 'class', { classId: 'c2' })).toBe(false);
  });
  it('student read if enrolled', () => {
    expect(can(student, 'read', 'class', { classId: 'c1' })).toBe(true);
    expect(can(student, 'read', 'class', { classId: 'c2' })).toBe(false);
    expect(can(student, 'write', 'class', { classId: 'c1' })).toBe(false);
  });
  it("parent reads children's classes", () => {
    expect(can(parent, 'read', 'class', { classId: 'c1' })).toBe(true);
    expect(can(parent, 'read', 'class', { classId: 'c2' })).toBe(false);
  });
});

describe('permissions — missions', () => {
  it('drafts: director read, teacher write own, students/parents never', () => {
    expect(can(director, 'read', 'mission_draft', { classId: 'c1' })).toBe(true);
    expect(can(director, 'write', 'mission_draft', { classId: 'c1' })).toBe(false);
    expect(can(teacher, 'write', 'mission_draft', { classId: 'c1' })).toBe(true);
    expect(can(teacher, 'write', 'mission_draft', { classId: 'c2' })).toBe(false);
    expect(can(student, 'read', 'mission_draft', { classId: 'c1' })).toBe(false);
    expect(can(parent, 'read', 'mission_draft', { classId: 'c1' })).toBe(false);
  });
  it('approved: student reads if enrolled, parent only family missions', () => {
    expect(can(student, 'read', 'mission', { classId: 'c1' })).toBe(true);
    expect(can(student, 'read', 'mission', { classId: 'c2' })).toBe(false);
    expect(can(parent, 'read', 'mission', { classId: 'c1', audience: 'FAMILY' })).toBe(true);
    expect(can(parent, 'read', 'mission', { classId: 'c1', audience: 'STUDENT' })).toBe(false);
    expect(can(teacher, 'write', 'mission', { classId: 'c1' })).toBe(true);
  });
});

describe('permissions — submissions', () => {
  it('director reads all', () => expect(can(director, 'read', 'submission', { classId: 'c1', ownerId: 'x' })).toBe(true));
  it('teacher reviews own classes only', () => {
    expect(can(teacher, 'review', 'submission', { classId: 'c1' })).toBe(true);
    expect(can(teacher, 'review', 'submission', { classId: 'c2' })).toBe(false);
  });
  it('student: own + assigned peer reviews only', () => {
    expect(can(student, 'read', 'submission', { ownerId: 'lea' })).toBe(true);
    expect(can(student, 'read', 'submission', { ownerId: 'karim' })).toBe(false);
    expect(can(student, 'read', 'submission', { ownerId: 'karim', assignedToActor: true })).toBe(true);
    expect(can(student, 'write', 'submission', { ownerId: 'karim', assignedToActor: true })).toBe(false);
  });
  it("parent reads children's only", () => {
    expect(can(parent, 'read', 'submission', { ownerId: 'lea' })).toBe(true);
    expect(can(parent, 'read', 'submission', { ownerId: 'omar' })).toBe(false);
    expect(can(parent, 'write', 'submission', { ownerId: 'lea' })).toBe(false);
  });
});

describe('permissions — progress, peer evaluation, summaries, uploads', () => {
  it('progress', () => {
    expect(can(director, 'read', 'progress', { ownerId: 'x' })).toBe(true);
    expect(can(teacher, 'read', 'progress', { ownerId: 'lea', ownerClassIds: ['c1'] })).toBe(true);
    expect(can(teacher, 'read', 'progress', { ownerId: 'z', ownerClassIds: ['c3'] })).toBe(false);
    expect(can(student, 'read', 'progress', { ownerId: 'lea' })).toBe(true);
    expect(can(student, 'read', 'progress', { ownerId: 'karim' })).toBe(false);
    expect(can(parent, 'read', 'progress', { ownerId: 'lea' })).toBe(true);
    expect(can(parent, 'read', 'progress', { ownerId: 'karim' })).toBe(false);
  });
  it('peer evaluation', () => {
    expect(can(director, 'read', 'peer_evaluation', { classId: 'c1' })).toBe(true);
    expect(can(teacher, 'override', 'peer_evaluation', { classId: 'c1' })).toBe(true);
    expect(can(teacher, 'override', 'peer_evaluation', { classId: 'c2' })).toBe(false);
    expect(can(student, 'write', 'peer_evaluation', { evaluatorId: 'lea' })).toBe(true);
    expect(can(student, 'write', 'peer_evaluation', { evaluatorId: 'karim' })).toBe(false);
    expect(can(parent, 'read', 'peer_evaluation', { evaluatorId: 'lea' })).toBe(false);
  });
  it('parent summary: own children only, nobody else', () => {
    expect(can(parent, 'read', 'parent_summary', { ownerId: 'lea' })).toBe(true);
    expect(can(parent, 'read', 'parent_summary', { ownerId: 'omar' })).toBe(false);
    expect(can(teacher, 'read', 'parent_summary', { ownerId: 'lea' })).toBe(false);
    expect(can(director, 'read', 'parent_summary', { ownerId: 'lea' })).toBe(false);
    expect(can(student, 'read', 'parent_summary', { ownerId: 'lea' })).toBe(false);
  });
  it('uploads', () => {
    expect(can(director, 'read', 'upload', { schoolId: S })).toBe(true);
    expect(can(teacher, 'read', 'upload', { classId: 'c1' })).toBe(true);
    expect(can(teacher, 'read', 'upload', { classId: 'c2' })).toBe(false);
    expect(can(student, 'read', 'upload', { ownerId: 'lea' })).toBe(true);
    expect(can(student, 'read', 'upload', { ownerId: 'karim', assignedToActor: true })).toBe(true);
    expect(can(student, 'read', 'upload', { ownerId: 'karim' })).toBe(false);
    expect(can(parent, 'read', 'upload', { ownerId: 'lea' })).toBe(true);
    expect(can(parent, 'read', 'upload', { ownerId: 'karim' })).toBe(false);
  });
  it('coarse role table defaults to deny', () => {
    expect(roleMayEver('STUDENT', 'write', 'members')).toBe(false);
    expect(roleMayEver('PARENT', 'review', 'submission')).toBe(false);
  });
});

describe('permissions — subject', () => {
  it('director/admin read & write school subjects', () => {
    for (const a of [director, admin]) {
      expect(can(a, 'read', 'subject', { schoolId: S })).toBe(true);
      expect(can(a, 'write', 'subject', { schoolId: S })).toBe(true);
    }
  });
  it('everyone else reads only', () => {
    for (const a of [teacher, student, parent]) {
      expect(can(a, 'read', 'subject', { schoolId: S })).toBe(true);
      expect(can(a, 'write', 'subject', { schoolId: S })).toBe(false);
    }
  });
  it('other school denied', () => {
    expect(can(director, 'write', 'subject', { schoolId: 'other' })).toBe(false);
  });
});

describe('permissions — course', () => {
  it('director/admin read & write any course in school', () => {
    for (const a of [director, admin]) {
      expect(can(a, 'write', 'course', { schoolId: S, courseClassIds: ['c9'] })).toBe(true);
      expect(can(a, 'read', 'course', { schoolId: 'other', courseClassIds: ['c9'] })).toBe(false);
    }
  });
  it('teacher reads/writes a course only when teaching one of its sections', () => {
    expect(can(teacher, 'write', 'course', { courseClassIds: ['c2', 'c1'] })).toBe(true);
    expect(can(teacher, 'read', 'course', { courseClassIds: ['c2'] })).toBe(false);
    expect(can(teacher, 'read', 'course', {})).toBe(false);
  });
  it('student/parent read only via an enrolled section, never write', () => {
    expect(can(student, 'read', 'course', { courseClassIds: ['c1', 'c3'] })).toBe(true);
    expect(can(student, 'read', 'course', { courseClassIds: ['c3'] })).toBe(false);
    expect(can(student, 'write', 'course', { courseClassIds: ['c1'] })).toBe(false);
    expect(can(parent, 'read', 'course', { courseClassIds: ['c1'] })).toBe(true);
    expect(can(parent, 'read', 'course', { courseClassIds: ['c2'] })).toBe(false);
    expect(can(parent, 'write', 'course', { courseClassIds: ['c1'] })).toBe(false);
  });
});

describe('peer assignment', () => {
  const c = (userId: string, over: Partial<Parameters<typeof isEligibleEvaluator>[0]> = {}) => ({
    userId,
    sameClass: true,
    enrollmentActive: true,
    topicMastered: true,
    openReviews: 0,
    lastAssignedAt: null as Date | null,
    ...over,
  });
  it('eligibility rules', () => {
    expect(isEligibleEvaluator(c('karim'), 'lea')).toBe(true);
    expect(isEligibleEvaluator(c('lea'), 'lea')).toBe(false);
    expect(isEligibleEvaluator(c('k', { sameClass: false }), 'lea')).toBe(false);
    expect(isEligibleEvaluator(c('k', { enrollmentActive: false }), 'lea')).toBe(false);
    expect(isEligibleEvaluator(c('k', { topicMastered: false }), 'lea')).toBe(false);
    expect(isEligibleEvaluator(c('k', { openReviews: 3 }), 'lea')).toBe(false);
  });
  it('load balancing: fewest open reviews', () => {
    expect(pickEvaluator([c('a', { openReviews: 2 }), c('b', { openReviews: 1 })], 'lea')?.userId).toBe('b');
  });
  it('tie-break by least recently assigned', () => {
    const r = pickEvaluator(
      [c('a', { lastAssignedAt: new Date('2026-10-08') }), c('b', { lastAssignedAt: new Date('2026-10-01') })],
      'lea',
    );
    expect(r?.userId).toBe('b');
  });
  it('none eligible → null (fallback to teacher)', () => {
    expect(pickEvaluator([c('lea'), c('x', { topicMastered: false })], 'lea')).toBeNull();
  });
  it('exclude list (reassignment)', () => {
    expect(pickEvaluator([c('a'), c('b', { openReviews: 1 })], 'lea', ['a'])?.userId).toBe('b');
  });
});

describe('codes', () => {
  it('school code from city', () => {
    expect(makeSchoolCode('Tripoli', () => 0.4821)).toBe('TRP-4821');
    expect(makeSchoolCode('Beirut', () => 0.0007)).toMatch(/^[A-Z]{3}-0007$/);
  });
  it('family code is 6 digits', () => {
    expect(makeFamilyCode(() => 0.000123)).toBe('000123');
  });
  it('family code checks', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(checkFamilyCode(null, now)).toBe('not_found');
    expect(checkFamilyCode({ expiresAt: new Date('2026-10-09T00:00:00Z'), usedAt: null }, now)).toBe('ok');
    expect(checkFamilyCode({ expiresAt: new Date('2026-10-08T11:00:00Z'), usedAt: null }, now)).toBe('expired');
    expect(checkFamilyCode({ expiresAt: new Date('2026-10-09T00:00:00Z'), usedAt: now }, now)).toBe('used');
  });
});

describe('safety prefilter', () => {
  it('rejects an unsafe mission', () => {
    expect(safetyPrefilter('Climb onto the roof edge at night and measure the drop')).toEqual(
      expect.arrayContaining(['Heights or climbing', 'Going out alone or at night']),
    );
  });
  it('accepts the shadow mission', () => {
    expect(safetyPrefilter('Stand in the sun with a parent nearby, measure your shadow and the building shadow with a tape measure')).toEqual([]);
  });
  it('sharp tools allowed with an adult', () => {
    expect(safetyPrefilter('Cut the pizza with a knife')).toContain('Sharp tools without an adult');
    expect(safetyPrefilter('Cut the pizza with a knife with an adult')).toEqual([]);
  });
});

describe('stuck detection & unlocks', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('two retries', () => expect(stuckReasons({ retriesOnTopic: 2, hintsWithoutSubmit: 0, inProgressSince: null, now })).toEqual(['RETRIES']));
  it('three hints', () => expect(stuckReasons({ retriesOnTopic: 0, hintsWithoutSubmit: 3, inProgressSince: null, now })).toEqual(['HINTS']));
  it('idle > 48h', () =>
    expect(stuckReasons({ retriesOnTopic: 0, hintsWithoutSubmit: 0, inProgressSince: new Date('2026-10-06T11:00:00Z'), now })).toEqual(['IDLE']));
  it('not stuck', () => expect(stuckReasons({ retriesOnTopic: 1, hintsWithoutSubmit: 2, inProgressSince: now, now })).toEqual([]));
  it('unlock when all prerequisites mastered', () => {
    const topics = [
      { id: 'area', prerequisiteIds: [] },
      { id: 'angles', prerequisiteIds: ['area'] },
      { id: 'similar', prerequisiteIds: ['angles'] },
      { id: 'mix', prerequisiteIds: ['angles', 'similar'] },
    ];
    expect(unlockedTopics(topics, new Set(['area', 'angles']))).toEqual(['similar']);
  });
});

it('makeFamilyCode random is in range', () => {
  for (let i = 0; i < 20; i++) expect(makeFamilyCode()).toMatch(/^\d{6}$/);
});
