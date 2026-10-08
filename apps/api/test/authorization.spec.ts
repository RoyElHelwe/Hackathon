import { createTestApp, TestCtx } from './app';

describe('authorization (integration)', () => {
  let ctx: TestCtx;
  let leaSubId: string;
  let lea: string, karim: string, omar: string, mona: string, rana: string, hassan: string, director: string;
  let classId: string;
  let omarId: string;
  let schoolId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    [lea, karim, omar, mona, rana, hassan, director] = await Promise.all(['lea', 'karim', 'omar', 'mona', 'rana', 'hassan', 'director'].map((h) => ctx.as(h)));
    const leaUser = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } });
    omarId = (await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'omar' } })).id;
    leaSubId = (await ctx.prisma.submission.findFirstOrThrow({ where: { studentId: leaUser.id } })).id;
    classId = (await ctx.prisma.class.findUniqueOrThrow({ where: { classroomCourseId: 'fake-8b-math' } })).id;
    schoolId = (await ctx.prisma.school.findFirstOrThrow()).id;
  });
  afterAll(async () => ctx.app.close());

  it('no session → 401', async () => {
    await ctx.http().get('/me').expect(401);
    await ctx.http().get('/missions').expect(401);
  });

  it("student cannot read another student's submission", async () => {
    await ctx.http().get(`/submissions/${leaSubId}`).set('Cookie', omar).expect(403);
    await ctx.http().get(`/submissions/${leaSubId}`).set('Cookie', karim).expect(403);
    await ctx.http().get(`/submissions/${leaSubId}`).set('Cookie', lea).expect(200);
  });

  it("parent cannot read an unlinked child's data", async () => {
    await ctx.http().get(`/dashboards/parent/${omarId}`).set('Cookie', mona).expect(403);
    await ctx.http().get(`/parents/summary/${omarId}`).set('Cookie', mona).expect(403);
    await ctx.http().get(`/submissions?studentId=${omarId}`).set('Cookie', mona).expect(403);
  });

  it("teacher cannot read another teacher's class", async () => {
    await ctx.http().get(`/classes/${classId}`).set('Cookie', hassan).expect(403);
    await ctx.http().get(`/dashboards/teacher/${classId}`).set('Cookie', hassan).expect(403);
    await ctx.http().get(`/classes/${classId}`).set('Cookie', rana).expect(200);
  });

  it('students and parents cannot reach staff endpoints', async () => {
    await ctx.http().get(`/dashboards/director/${schoolId}`).set('Cookie', lea).expect(403);
    await ctx.http().get(`/schools/${schoolId}/members`).set('Cookie', mona).expect(403);
    await ctx.http().get('/teacher/review-queue').set('Cookie', lea).expect(403);
    await ctx.http().post('/missions/generate').set('Cookie', lea).send({}).expect(403);
    await ctx.http().post(`/submissions/${leaSubId}/teacher-review`).set('Cookie', karim).send({ score: 100 }).expect(403);
  });

  it('teachers cannot approve staff; directors can', async () => {
    const pending = await ctx.prisma.membership.findFirstOrThrow({ where: { status: 'PENDING' } });
    await ctx.http().post(`/memberships/${pending.id}/approve`).set('Cookie', rana).expect(403);
    await ctx.http().post(`/memberships/${pending.id}/approve`).set('Cookie', director).expect(201);
  });

  it('students never see drafts; teachers of other classes cannot edit missions', async () => {
    const topic = await ctx.prisma.topic.findUniqueOrThrow({ where: { key: 'geo.angles' } });
    const drafts = (await ctx.http().post('/missions/generate').set('Cookie', rana).send({ topicId: topic.id, classId, count: 1 }).expect(201)).body;
    await ctx.http().get(`/missions/${drafts[0].id}`).set('Cookie', lea).expect(403);
    await ctx.http().patch(`/missions/${drafts[0].id}`).set('Cookie', hassan).send({ estimatedMin: 30 }).expect(403);
    const leaList = (await ctx.http().get('/missions').set('Cookie', lea).expect(200)).body;
    expect(leaList.some((m: { id: string }) => m.id === drafts[0].id)).toBe(false);
  });

  it('leaderboard is 403 while disabled', async () => {
    await ctx.http().get(`/classes/${classId}/leaderboard`).set('Cookie', lea).expect(403);
    await ctx.http().patch(`/classes/${classId}/settings`).set('Cookie', rana).send({ leaderboardEnabled: true }).expect(200);
    const lb = (await ctx.http().get(`/classes/${classId}/leaderboard`).set('Cookie', lea).expect(200)).body;
    expect(lb.top.length).toBeLessThanOrEqual(5);
    expect(lb.me.rank).toBeGreaterThan(0);
  });
});
