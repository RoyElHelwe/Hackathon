import { AuthService } from '../src/auth/auth.service';
import { createTestApp, TestCtx } from './app';

describe('teacher subjects (integration)', () => {
  let ctx: TestCtx;
  let sid: string;
  let dirCookie: string;
  let phys: { id: string };
  let chem: { id: string };
  let code: string;
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
  });
  afterAll(async () => ctx.app.close());

  it('teacher invite requires ≥1 subject from this school; accept stores them', async () => {
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER' }).expect(400);
    await ctx.http().post('/invites').set('Cookie', dirCookie).send({ email: 't1@x.test', role: 'TEACHER', subjectIds: ['nope'] }).expect(400);
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
    const pub = (await ctx.http().get(`/schools/by-code/${code}/subjects`).expect(200)).body;
    expect(pub.subjects).toHaveLength(2);
    const t = await ctx.app.get(AuthService).upsertFromGoogle({ googleId: 'g-t2', email: 't2@x.test', name: 'Tarek' });
    const tc = ctx.cookieFor(t.id);
    const joined = (await ctx.http().post('/schools/join').set('Cookie', tc).send({ code, role: 'TEACHER', subjectIds: [chem.id] }).expect(201)).body;
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(1);
    await ctx.http().put(`/memberships/${joined.membership.id}/subjects`).set('Cookie', dirCookie).send({ subjectIds: [phys.id, chem.id] }).expect(200);
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(2);
    await ctx.http().put(`/memberships/${joined.membership.id}/subjects`).set('Cookie', tc).send({ subjectIds: [phys.id] }).expect(403);
    await ctx.http().post(`/memberships/${joined.membership.id}/reject`).set('Cookie', dirCookie).expect(201);
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: t.id } })).toBe(0);
  });
});
