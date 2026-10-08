import path from 'node:path';
import { createTestApp, TestCtx } from './app';

const PHOTO = path.join(__dirname, '../../../e2e/fixtures/shadow.jpg');

describe('golden loop (integration)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.app.close());

  it('start → submit → AI check → follow-up → peer → VALIDATED → XP, unlock, badge, grade passback', async () => {
    const lea = await ctx.as('lea');
    const karim = await ctx.as('karim');
    const missions = (await ctx.http().get('/missions').set('Cookie', lea).expect(200)).body;
    const hero = missions.find((m: { key: string }) => m.key === 'm.similar.shadows');
    expect(hero).toBeDefined();

    const started = (await ctx.http().post('/submissions').set('Cookie', lea).send({ missionId: hero.id }).expect(201)).body;
    expect(started.status).toBe('IN_PROGRESS');

    const hint = (await ctx.http().post(`/submissions/${started.id}/hint`).set('Cookie', lea).send({}).expect(201)).body;
    expect(hint.level).toBe(1);
    expect(hint.hint).not.toMatch(/13\.7/);

    const up = (await ctx.http().post('/uploads').set('Cookie', lea).attach('file', PHOTO).expect(201)).body;
    expect(up.kind).toBe('IMAGE');

    const checked = (
      await ctx
        .http()
        .post(`/submissions/${started.id}/submit`)
        .set('Cookie', lea)
        .send({ photoUploadIds: [up.id], explanation: 'I am 1.55 m and my shadow is 2.1 m; the building shadow is 18.6 m so H = 13.7 m.', answers: { h: 1.55, s: 2.1, S: 18.6, H: 13.7 } })
        .expect(201)
    ).body;
    expect(checked.status).toBe('AI_CHECKED');
    expect(checked.aiCheck.score).toBeGreaterThanOrEqual(50);
    expect(checked.aiCheck.followUpQuestion).toBeTruthy();

    const routed = (await ctx.http().post(`/submissions/${started.id}/follow-up`).set('Cookie', lea).send({ answer: 'No, both shadows grow with the same ratio.' }).expect(201)).body;
    expect(routed.status).toBe('PEER_REVIEW');
    expect(routed.peer.evaluatorFirstName).toBe('Karim');

    const wallet = await ctx.prisma.wallet.findUniqueOrThrow({ where: { studentId: routed.mission ? (await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } })).id : '' } });
    expect(wallet.points).toBe(2); // spent 1 point

    const assigned = (await ctx.http().get('/peer-reviews/assigned').set('Cookie', karim).expect(200)).body;
    expect(assigned).toHaveLength(1);
    const sheet = (await ctx.http().get(`/peer-reviews/${assigned[0].id}`).set('Cookie', karim).expect(200)).body;
    expect(sheet.sheet.questionsToAsk).toHaveLength(3);
    // Karim (assigned evaluator) can see Lea's photo
    await ctx.http().get(`/uploads/${up.id}`).set('Cookie', karim).expect(200);

    const done = (
      await ctx
        .http()
        .post(`/peer-reviews/${assigned[0].id}/complete`)
        .set('Cookie', karim)
        .send({ checklist: sheet.sheet.checklist.map((c: { criterion: string }) => ({ criterion: c.criterion, ok: true })), score: 85, comment: 'Great job' })
        .expect(201)
    ).body;
    expect(done.outcome).toBe('VALIDATED');

    const final = (await ctx.http().get(`/submissions/${started.id}`).set('Cookie', lea).expect(200)).body;
    expect(final.status).toBe('VALIDATED');
    expect(final.finalScore).toBe(Math.round(0.6 * final.effectiveAiScore + 0.4 * 85));
    expect(final.rewards.xpGained).toBe(70);
    expect(final.rewards.levelBefore).toBe(2);
    expect(final.rewards.levelAfter).toBe(3);
    expect(final.rewards.newBadges.map((b: { key: string }) => b.key)).toContain('shadow_hunter');
    expect(final.rewards.unlockedTopics.map((t: { key: string }) => t.key)).toEqual(['geo.pythagoras']);

    const graph = (await ctx.http().get('/subjects/math/graph').set('Cookie', lea).expect(200)).body;
    const state = (k: string) => graph.nodes.find((n: { key: string }) => n.key === k).state;
    expect(state('geo.similar')).toBe('MASTERED');
    expect(state('geo.pythagoras')).toBe('AVAILABLE');

    // Grade passback went to the (fake) Classroom
    expect(ctx.fake.gradeCalls).toEqual([{ courseId: 'fake-8b-math', courseWorkId: 'fake-cw-shadows', studentGoogleId: 'seed-lea', grade: final.finalScore }]);
    expect(final.gradeSynced).toBe(true);

    // Karim got evaluator rewards
    const kg = (await ctx.http().get('/gamification/me').set('Cookie', karim).expect(200)).body;
    expect(kg.wallet).toBe(5);
    expect(kg.recentXp[0].reason).toBe('PEER_EVAL_GIVEN');
  });

  it('copy detection: the same photo from another student goes to the teacher', async () => {
    const omar = await ctx.as('omar');
    const missions = (await ctx.http().get('/missions').set('Cookie', omar).expect(200)).body;
    const area = missions.find((m: { key: string }) => m.key === 'm.circles.pizza');
    const s = (await ctx.http().post('/submissions').set('Cookie', omar).send({ missionId: area.id }).expect(201)).body;
    const up = (await ctx.http().post('/uploads').set('Cookie', omar).attach('file', PHOTO).expect(201)).body;
    const checked = (await ctx.http().post(`/submissions/${s.id}/submit`).set('Cookie', omar).send({ photoUploadIds: [up.id], explanation: 'Each slice is 360 / 7 = 51.4 degrees.' }).expect(201)).body;
    expect(checked.aiCheck.flags).toContain('possible_copy');
    const routed = (await ctx.http().post(`/submissions/${s.id}/follow-up`).set('Cookie', omar).send({ answer: 'Because a full turn is 360 degrees.' }).expect(201)).body;
    expect(routed.status).toBe('TEACHER_REVIEW');
  });

  it('low AI score → RETRY → restart with attempt + 1', async () => {
    const omar = await ctx.as('omar');
    const missions = (await ctx.http().get('/missions').set('Cookie', omar).expect(200)).body;
    const vol = missions.find((m: { key: string }) => m.key === 'm.volume.tank');
    const s = (await ctx.http().post('/submissions').set('Cookie', omar).send({ missionId: vol.id }).expect(201)).body;
    const checked = (await ctx.http().post(`/submissions/${s.id}/submit`).set('Cookie', omar).send({ photoUploadIds: [], explanation: 'idk' }).expect(201)).body;
    expect(checked.status).toBe('RETRY');
    await ctx.http().post(`/submissions/${s.id}/follow-up`).set('Cookie', omar).send({ answer: 'x' }).expect(409);
    const restarted = (await ctx.http().post(`/submissions/${s.id}/retry`).set('Cookie', omar).expect(201)).body;
    expect(restarted.status).toBe('IN_PROGRESS');
    expect(restarted.attempt).toBe(2);
  });

  it('family mission: parent confirms → VALIDATED with family bonus', async () => {
    const mona = await ctx.as('mona');
    const fam = (await ctx.http().get('/families/missions').set('Cookie', mona).expect(200)).body;
    const sub = fam[0].childSubmissions[0];
    expect(sub.status).toBe('FAMILY_CONFIRM');
    const r = (await ctx.http().post(`/families/missions/${sub.id}/confirm`).set('Cookie', mona).send({ note: 'Fun!' }).expect(201)).body;
    expect(r.rewards.xpEvents.map((e: { reason: string }) => e.reason)).toContain('FAMILY_MISSION');
    // Teacher dashboards and summaries still work after
    const summary = (await ctx.http().get(`/parents/summary/${sub.child.id}`).set('Cookie', mona).expect(200)).body;
    expect(summary.locale).toBe('ar');
    expect(summary.content.highlights.length).toBeGreaterThan(0);
  });
});
