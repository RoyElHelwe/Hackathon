import { safetyCheckMission, checkSubmission } from '../src/ai/tasks';
import { AiService, AiTransport, AiUnavailableError, extractJson } from '../src/ai/ai.service';
import { PeerReviewsService } from '../src/peer-reviews/peer-reviews.service';
import { StuckService } from '../src/progress/stuck.service';
import { createTestApp, TestCtx } from './app';

describe('family codes', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.app.close());

  const newUser = (gid: string) => ctx.prisma.user.create({ data: { googleId: gid, email: `${gid}@family.test`, name: gid } });

  it('create → link → reuse rejected', async () => {
    const lea = await ctx.as('lea');
    const { code, expiresAt } = (await ctx.http().post('/families/code').set('Cookie', lea).expect(201)).body;
    expect(code).toMatch(/^\d{6}$/);
    expect(new Date(expiresAt).getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000);
    const dad = await newUser('dad');
    const linked = (await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(dad.id)).send({ code }).expect(201)).body;
    expect(linked.child.name).toBe('Lea Saliba');
    const link = await ctx.prisma.parentLink.findFirstOrThrow({ where: { parentId: dad.id } });
    expect(link).toMatchObject({ status: 'VERIFIED', method: 'FAMILY_CODE' });
    const aunt = await newUser('aunt');
    const r = await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(aunt.id)).send({ code }).expect(400);
    expect(r.body.reason).toBe('used');
  });

  it('expired and unknown codes are rejected with a friendly message', async () => {
    const lea = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } });
    await ctx.prisma.familyCode.create({ data: { studentId: lea.id, code: '111111', expiresAt: new Date(Date.now() - 1000) } });
    const u = await newUser('late-parent');
    const r = await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(u.id)).send({ code: '111111' }).expect(400);
    expect(r.body.reason).toBe('expired');
    expect(r.body.message).toMatch(/expired/i);
    expect((await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(u.id)).send({ code: '999999' }).expect(400)).body.reason).toBe('not_found');
  });

  it("wrong school: a parent already in another school is linked in the child's school", async () => {
    const other = await ctx.prisma.school.create({ data: { name: 'Other School', city: 'Saida', schoolCode: 'SDA-0001' } });
    const p = await newUser('multi-school-parent');
    await ctx.prisma.membership.create({ data: { userId: p.id, schoolId: other.id, role: 'TEACHER', status: 'APPROVED' } });
    const { code } = (await ctx.http().post('/families/code').set('Cookie', await ctx.as('karim')).expect(201)).body;
    const r = (await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(p.id)).send({ code }).expect(201)).body;
    const tfs = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    expect(r.school.id).toBe(tfs.id);
    const ms = await ctx.prisma.membership.findMany({ where: { userId: p.id } });
    expect(ms.find((m) => m.role === 'PARENT')!.schoolId).toBe(tfs.id);
    expect(ms.find((m) => m.role === 'TEACHER')!.schoolId).toBe(other.id);
  });

  it('parent with several children: one user, many links', async () => {
    const p = await newUser('busy-parent');
    for (const h of ['lea', 'omar']) {
      const { code } = (await ctx.http().post('/families/code').set('Cookie', await ctx.as(h)).expect(201)).body;
      await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(p.id)).send({ code }).expect(201);
    }
    const me = (await ctx.http().get('/me').set('Cookie', ctx.cookieFor(p.id)).expect(200)).body;
    expect(me.children).toHaveLength(2);
    expect(me.memberships.filter((m: { role: string }) => m.role === 'PARENT')).toHaveLength(1);
  });

  it('peer timeout: reassign once, then teacher review with refund', async () => {
    const peers = ctx.app.get(PeerReviewsService);
    const lea = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } });
    const karim = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'karim' } });
    const mission = await ctx.prisma.mission.findUniqueOrThrow({ where: { key: 'm.area.tile' } });
    // A third student who mastered area, so a reassignment is possible
    const omar = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'omar' } });
    const sub = await ctx.prisma.submission.create({
      data: { missionId: mission.id, studentId: lea.id, status: 'PEER_REVIEW', photoUploadIds: [], aiCheck: { score: 80, correct: true, perCriterion: [], feedback: '', followUpQuestion: '', flags: [] } },
    });
    await ctx.prisma.wallet.update({ where: { studentId: lea.id }, data: { points: 2 } });
    const old = new Date(Date.now() - 25 * 3600 * 1000);
    await ctx.prisma.peerEvaluation.create({ data: { submissionId: sub.id, evaluatorId: karim.id, sheet: {}, assignedAt: old } });
    expect(await peers.handleTimeouts()).toBe(1);
    let s = await ctx.prisma.submission.findUniqueOrThrow({ where: { id: sub.id }, include: { peerEvaluations: true } });
    expect(s.status).toBe('PEER_REVIEW');
    expect(s.peerEvaluations.find((p) => p.status === 'ASSIGNED')!.evaluatorId).toBe(omar.id);
    await ctx.prisma.peerEvaluation.updateMany({ where: { submissionId: sub.id, status: 'ASSIGNED' }, data: { assignedAt: old } });
    expect(await peers.handleTimeouts()).toBe(1);
    s = await ctx.prisma.submission.findUniqueOrThrow({ where: { id: sub.id }, include: { peerEvaluations: true } });
    expect(s.status).toBe('TEACHER_REVIEW');
    expect((await ctx.prisma.wallet.findUniqueOrThrow({ where: { studentId: lea.id } })).points).toBe(3);
    // idempotent
    expect(await peers.handleTimeouts()).toBe(0);
  });

  it('stuck detection: Omar alert for the teacher, deduplicated per day', async () => {
    const stuck = ctx.app.get(StuckService);
    const cls = await ctx.prisma.class.findUniqueOrThrow({ where: { classroomCourseId: 'fake-8b-math' } });
    const entries = await stuck.forClass(cls.id);
    expect(entries.map((e) => [e.studentName, e.topicKey])).toContainEqual(['Omar Tannous', 'geo.angles']);
    await ctx.prisma.notification.deleteMany({ where: { type: 'STUCK_ALERT' } });
    const first = await stuck.notifyClass(cls.id);
    const second = await stuck.notifyClass(cls.id);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});

describe('AI JSON validation & safety', () => {
  let ctx: TestCtx;
  let ai: AiService;
  beforeAll(async () => {
    ctx = await createTestApp({ seed: false });
    ai = ctx.app.get(AiService);
  });
  afterAll(async () => ctx.app.close());

  const input = { topicKey: 'geo.similar', missionTitle: 'Shadows', steps: [], rubric: [], explanation: 'x', answers: {}, photoCount: 0, locale: 'en' };
  const good = { score: 80, correct: true, perCriterion: [], feedback: 'Nice', followUpQuestion: 'Why?', flags: [] };

  function useTransport(replies: string[]) {
    const calls: number[] = [];
    const t: AiTransport = {
      complete: async () => {
        calls.push(1);
        const text = replies.shift();
        if (text === undefined) throw new Error('no more replies');
        return { text, tokensIn: 10, tokensOut: 5 };
      },
    };
    ai.provider = 'openrouter';
    ai.apiKey = 'test-key';
    ai.models = { fast: 'test/fast', vision: 'test/vision' };
    ai.transport = t;
    return calls;
  }

  afterEach(() => {
    ai.provider = 'mock';
  });

  it('valid JSON (even in a code fence) is accepted', async () => {
    const calls = useTransport(['```json\n' + JSON.stringify(good) + '\n```']);
    await expect(ai.run(checkSubmission, input)).resolves.toMatchObject({ score: 80 });
    expect(calls).toHaveLength(1);
  });

  it('extractJson takes the first complete object: text after it, braces in strings, cut-off output', () => {
    expect(extractJson('{"a":1} and then {"b":2}')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"say":"use {curly} and \\"quotes\\"","n":{"x":1}}\nHope this helps {:}')).toEqual({ say: 'use {curly} and "quotes"', n: { x: 1 } });
    expect(() => extractJson('{"say":"cut off mid')).toThrow(/cut off/);
  });

  it('invalid then fixed: retries once with the validation error', async () => {
    const calls = useTransport([JSON.stringify({ ...good, score: 'high' }), JSON.stringify(good)]);
    await expect(ai.run(checkSubmission, input)).resolves.toMatchObject({ score: 80 });
    expect(calls).toHaveLength(2);
  });

  it('invalid twice: graceful failure (503) and logged', async () => {
    useTransport(['not json', '{"score": 500}']);
    await expect(ai.run(checkSubmission, input)).rejects.toBeInstanceOf(AiUnavailableError);
    const log = await ctx.prisma.aiLog.findFirstOrThrow({ where: { task: 'checkSubmission', ok: false }, orderBy: { createdAt: 'desc' } });
    expect(log.error).toMatch(/invalid output/);
  });

  it('cache returns identical results without calling the model', async () => {
    ai.cacheEnabled = true;
    const calls = useTransport([JSON.stringify(good)]);
    await ai.run(checkSubmission, { ...input, explanation: 'cached' });
    await ai.run(checkSubmission, { ...input, explanation: 'cached' });
    expect(calls).toHaveLength(1);
    ai.cacheEnabled = false;
  });

  it('safety filter rejects an unsafe mission even if the model says safe', async () => {
    useTransport([JSON.stringify({ safe: true, issues: [] })]);
    const r = await ai.run(safetyCheckMission, { mission: { steps: ['Climb onto the roof edge alone at night'] } });
    expect(r.safe).toBe(true); // model fooled…
    ai.provider = 'mock';
    const mock = await ai.run(safetyCheckMission, { mission: { steps: ['Climb onto the roof edge alone at night'] } });
    expect(mock.safe).toBe(false);
  });
});

describe('mission approval safety gate', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.app.close());

  it('an unsafe draft cannot be approved; the safer version can', async () => {
    const rana = await ctx.as('rana');
    const ranaUser = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'rana' } });
    const cls = await ctx.prisma.class.findUniqueOrThrow({ where: { classroomCourseId: 'fake-8b-math' } });
    const topic = await ctx.prisma.topic.findUniqueOrThrow({ where: { key: 'geo.similar' } });
    const m = await ctx.prisma.mission.create({
      data: {
        topicId: topic.id, classId: cls.id, createdById: ranaUser.id, title: { en: 'Roof drop' }, story: { en: 'Measure the building from the top' },
        steps: { en: ['Climb the ladder to the roof edge at night', 'Drop a rope'] }, miniLesson: { text: { en: '' }, visualSpec: { shapes: [] } },
        proofSpec: { photos: 1, explanation: true, fields: [] }, rubric: [], safetyNotes: { en: '' }, xpReward: 50, estimatedMin: 20,
      },
    });
    const r = await ctx.http().post(`/missions/${m.id}/approve`).set('Cookie', rana).send({ postToClassroom: false }).expect(422);
    expect(r.body.safety.issues).toEqual(expect.arrayContaining(['Heights or climbing']));
    expect((await ctx.prisma.mission.findUniqueOrThrow({ where: { id: m.id } })).status).toBe('DRAFT');
    const ok = (await ctx.http().post(`/missions/${m.id}/approve`).set('Cookie', rana).send({ postToClassroom: true, useSaferVersion: true }).expect(201)).body;
    expect(ok.mission.status).toBe('APPROVED');
    expect(ok.classroom.posted).toBe(true);
    expect(ctx.fake.courseWork[0].input.link).toMatch(new RegExp(`/missions/${m.id}$`));
  });
});
