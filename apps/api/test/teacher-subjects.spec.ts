import { AuthService } from '../src/auth/auth.service';
import { createTestApp, TestCtx } from './app';

describe('teacher subjects (integration)', () => {
  let ctx: TestCtx;
  let sid: string;
  let dirCookie: string;
  let phys: { id: string };
  let chem: { id: string };
  let code: string;
  let otherSubj: { id: string };
  beforeAll(async () => {
    ctx = await createTestApp({ seed: false });
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-d', email: 'd@x.test', name: 'Dir' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir.id)).send({ name: 'Sub School', city: 'Beirut' }).expect(201);
    dirCookie = created.headers['set-cookie'][0].split(';')[0];
    sid = created.body.id;
    code = created.body.schoolCode;
    phys = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', dirCookie).send({ name: 'Physics' }).expect(201)).body;
    chem = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', dirCookie).send({ name: 'Chemistry' }).expect(201)).body;

    // A second, unrelated school with its own subject — used to prove cross-school subject ids are rejected.
    const dir2 = await auth.upsertFromGoogle({ googleId: 'g-d2', email: 'd2@x.test', name: 'Dir2' });
    const created2 = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir2.id)).send({ name: 'Other School', city: 'Tripoli' }).expect(201);
    const dir2Cookie = created2.headers['set-cookie'][0].split(';')[0];
    otherSubj = (await ctx.http().post(`/schools/${created2.body.id}/subjects`).set('Cookie', dir2Cookie).send({ name: 'Biology' }).expect(201)).body;
  });
  afterAll(async () => ctx.app.close());

  it('teacher invite requires ≥1 subject from this school; accept stores them', async () => {
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER' }).expect(400);
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER', subjectIds: ['nope'] }).expect(400);
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER', subjectIds: [otherSubj.id] }).expect(400);
    expect(await ctx.prisma.invite.count({ where: { email: 't1@x.test' } })).toBe(0);
    const inv = (await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER', subjectIds: [phys.id] }).expect(201)).body;
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t1', email: 't1@x.test', name: 'Tala' });
    await ctx.http().post(`/invites/${inv.token}/accept`).set('Cookie', ctx.cookieFor(t.id)).expect(201);
    const rows = await ctx.prisma.teacherSubject.findMany({ where: { teacherId: t.id } });
    expect(rows.map((r) => r.subjectId)).toEqual([phys.id]);
    const members = (await ctx.http().get(`/schools/${sid}/members?status=APPROVED`).set('Cookie', dirCookie).expect(200)).body;
    const row = members.find((m: { user: { email: string } }) => m.user.email === 't1@x.test');
    expect(row.subjects.map((s: { id: string }) => s.id)).toEqual([phys.id]);
  });

  it('code-join with subjects; reject removes them; director edits subjects', async () => {
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t2', email: 't2@x.test', name: 'Tarek' });
    const tc = ctx.cookieFor(t.id);
    // Subject lookup by code needs a signed-in user (the onboarding caller always is).
    await ctx.http().get(`/schools/by-code/${code}/subjects`).expect(401);
    const pub = (await ctx.http().get(`/schools/by-code/${encodeURIComponent(code)}/subjects`).set('Cookie', tc).expect(200)).body;
    expect(pub.subjects).toHaveLength(2);
    const joined = (await ctx.http().post('/schools/join').set('Cookie', tc).send({ code, role: 'TEACHER', subjectIds: [chem.id] }).expect(201)).body;
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(1);
    await ctx.http().put(`/memberships/${joined.membership.id}/subjects`).set('Cookie', dirCookie).send({ subjectIds: [phys.id, chem.id] }).expect(200);
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(2);
    await ctx.http().put(`/memberships/${joined.membership.id}/subjects`).set('Cookie', tc).send({ subjectIds: [phys.id] }).expect(403);
    await ctx.http().post(`/memberships/${joined.membership.id}/reject`).set('Cookie', dirCookie).expect(201);
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(0);
  });

  it('code-join with an invalid subject id fails without creating an orphan membership', async () => {
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t3', email: 't3@x.test', name: 'Lina' });
    await ctx.http().post('/schools/join').set('Cookie', ctx.cookieFor(t.id)).send({ code, role: 'TEACHER', subjectIds: ['nope'] }).expect(400);
    expect(await ctx.prisma.membership.count({ where: { userId: t.id } })).toBe(0);
  });

  it('an APPROVED teacher cannot rewrite their own subjects by re-joining with the code', async () => {
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t4', email: 't4@x.test', name: 'Rami' });
    const tc = ctx.cookieFor(t.id);
    const joined = (await ctx.http().post('/schools/join').set('Cookie', tc).send({ code, role: 'TEACHER', subjectIds: [phys.id] }).expect(201)).body;
    // While still PENDING, re-joining may correct the picked subjects.
    await ctx.http().post('/schools/join').set('Cookie', tc).send({ code, role: 'TEACHER', subjectIds: [chem.id] }).expect(201);
    expect((await ctx.prisma.teacherSubject.findMany({ where: { teacherId: t.id } })).map((r) => r.subjectId)).toEqual([chem.id]);
    await ctx.http().post(`/memberships/${joined.membership.id}/approve`).set('Cookie', dirCookie).expect(201);
    await ctx.http().post('/schools/join').set('Cookie', tc).send({ code, role: 'TEACHER', subjectIds: [phys.id] }).expect(201);
    const rows = await ctx.prisma.teacherSubject.findMany({ where: { teacherId: t.id } });
    expect(rows.map((r) => r.subjectId)).toEqual([chem.id]);
  });

  it('accepting an invite whose subject was deleted keeps the remaining subjects and succeeds', async () => {
    const tmp = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', dirCookie).send({ name: 'Drama' }).expect(201)).body;
    const inv = (await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't5@x.test', role: 'TEACHER', subjectIds: [phys.id, tmp.id] }).expect(201)).body;
    await ctx.http().delete(`/schools/${sid}/subjects/${tmp.id}`).set('Cookie', dirCookie).expect(200);
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t5', email: 't5@x.test', name: 'Maya' });
    await ctx.http().post(`/invites/${inv.token}/accept`).set('Cookie', ctx.cookieFor(t.id)).expect(201);
    const m = await ctx.prisma.membership.findFirstOrThrow({ where: { userId: t.id, schoolId: sid, role: 'TEACHER' } });
    expect(m.status).toBe('APPROVED');
    expect((await ctx.prisma.invite.findUniqueOrThrow({ where: { token: inv.token } })).usedAt).not.toBeNull();
    const rows = await ctx.prisma.teacherSubject.findMany({ where: { teacherId: t.id } });
    expect(rows.map((r) => r.subjectId)).toEqual([phys.id]);
  });
});
