import { fallbackTurn, type AssistantCatalog } from '../src/ai/tasks/assistant-turn';

const catalog: AssistantCatalog = {
  teachers: [{ token: 'T1', subjects: ['math'] }],
  subjects: [{ key: 'math', name: 'Mathematics' }, { key: 'arabic', name: 'Arabic' }],
  grades: [7, 8, 9],
  sections: ['7A', '7B', '8A', '8B', '9A', '9B'],
  hasTimetable: true,
  pendingMembers: 1,
};
const turn = (message: string, locale = 'en') => fallbackTurn({ locale, message, catalog });

describe('Ask Arzino keyword fallback (also the mock AI)', () => {
  it('absence with day, periods and reason', () => {
    const out = turn('T1 is sick tomorrow, periods 2 and 4');
    expect(out.intents).toEqual([{ kind: 'report_absence', teacher: 'T1', when: 'tomorrow', periods: [2, 4], reason: 'SICK' }]);
  });
  it('absence in Arabic', () => {
    const out = turn('الأستاذ T1 غائب يوم الثلاثاء', 'ar');
    expect(out.intents[0]).toMatchObject({ kind: 'report_absence', teacher: 'T1', when: 'tue' });
    expect(out.reply).toMatch(/[؀-ۿ]/);
  });
  it('build the timetable', () => {
    expect(turn("Build next week's timetable").intents).toEqual([{ kind: 'build_timetable' }]);
    expect(turn('ابنِ الجدول للأسبوع القادم', 'ar').intents[0].kind).toBe('build_timetable');
  });
  it('a plain-words rule', () => {
    expect(turn('Sport should never be in the first period').intents[0]).toMatchObject({ kind: 'add_rule' });
  });
  it('announcement to grade 8 parents with content', () => {
    const out = turn('Announce to grade 8 parents: the science fair is on Friday at 10');
    expect(out.intents[0]).toMatchObject({ kind: 'announce', audience: 'GRADE', grade: 8, includeParents: true });
    expect((out.intents[0] as { body: string }).body).toMatch(/science fair/i);
  });
  it('section announcement', () => {
    expect(turn('Tell 8B that the trip is moved to Monday').intents[0]).toMatchObject({ kind: 'announce', audience: 'SECTION', section: '8B' });
  });
  it('invite with subjects, approve, insights, nudges, digests', () => {
    expect(turn('Invite E1 to teach math').intents[0]).toEqual({ kind: 'invite_teacher', email: 'E1', subjects: ['math'] });
    expect(turn('Approve the pending teachers').intents[0].kind).toBe('approve_members');
    expect(turn('Which classes need help this week?').intents[0]).toEqual({ kind: 'insight', metric: 'STRUGGLING_CLASSES' });
    expect(turn('Remind families who have not linked yet').intents[0].kind).toBe('nudge_families');
    expect(turn('Send the weekly digests to parents').intents[0].kind).toBe('send_digests');
  });
  it('asks a question when unclear', () => {
    const out = turn('hello');
    expect(out.intents).toEqual([]);
    expect(out.reply).toMatch(/What would you like/);
  });
});
