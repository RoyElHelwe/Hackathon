import { AuthService } from '../src/auth/auth.service';
import { createTestApp, TestCtx } from './app';

describe('school subjects (integration)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.app.close());

  it('seed: demo school owns its 6 subjects; seeded teachers teach math; seeded classes are math', async () => {
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    const subjects = await ctx.prisma.subject.findMany({ where: { schoolId: school.id } });
    expect(subjects.map((s) => s.key).sort()).toEqual(['biology', 'chemistry', 'history', 'languages', 'math', 'physics']);
    const math = subjects.find((s) => s.key === 'math')!;
    const rana = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'rana' } });
    expect(await ctx.prisma.teacherSubject.count({ where: { teacherId: rana.id, subjectId: math.id } })).toBe(1);
    const classes = await ctx.prisma.class.findMany({ where: { schoolId: school.id } });
    expect(classes.every((c) => c.subjectId === math.id)).toBe(true);
  });

  it('GET /subjects lists only the active school subjects', async () => {
    const lea = await ctx.as('lea');
    const list = (await ctx.http().get('/subjects').set('Cookie', lea).expect(200)).body;
    expect(list.map((s: { key: string }) => s.key)).toContain('math');
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-new-dir', email: 'newdir@x.test', name: 'New Dir' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir.id)).send({ name: 'Empty School', city: 'Saida' }).expect(201);
    const session = created.headers['set-cookie'][0].split(';')[0];
    expect((await ctx.http().get('/subjects').set('Cookie', session).expect(200)).body).toEqual([]);
  });

  it('director CRUD: create (AI fills Arabic), duplicate 409, rename, delete guard', async () => {
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-crud-dir', email: 'crud@x.test', name: 'Crud Dir' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(dir.id)).send({ name: 'Crud School', city: 'Tyre' }).expect(201);
    const c = created.headers['set-cookie'][0].split(';')[0];
    const sid = created.body.id;

    const phys = (await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', c).send({ name: 'Physics', color: 'sky', icon: 'zap' }).expect(201)).body;
    expect(phys.name.en).toBe('Physics');
    expect(typeof phys.name.ar).toBe('string');
    expect(phys.key).toMatch(/^s_/);
    await ctx.http().post(`/schools/${sid}/subjects`).set('Cookie', c).send({ name: '  physics ' }).expect(409);

    const renamed = (await ctx.http().patch(`/schools/${sid}/subjects/${phys.id}`).set('Cookie', c).send({ name: 'Physics & Science' }).expect(200)).body;
    expect(renamed.name.en).toBe('Physics & Science');

    const list = (await ctx.http().get(`/schools/${sid}/subjects`).set('Cookie', c).expect(200)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ classCount: 0, teacherCount: 0 });

    const cls = await ctx.prisma.class.create({ data: { schoolId: sid, name: '9 Phys', subjectId: phys.id } });
    await ctx.http().delete(`/schools/${sid}/subjects/${phys.id}`).set('Cookie', c).expect(409);
    await ctx.prisma.class.delete({ where: { id: cls.id } });
    await ctx.http().delete(`/schools/${sid}/subjects/${phys.id}`).set('Cookie', c).expect(200);
    expect(await ctx.prisma.subject.count({ where: { schoolId: sid } })).toBe(0);
  });

  it('teachers cannot write subjects; other schools cannot read them', async () => {
    const rana = await ctx.as('rana');
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    await ctx.http().get(`/schools/${school.id}/subjects`).set('Cookie', rana).expect(200);
    await ctx.http().post(`/schools/${school.id}/subjects`).set('Cookie', rana).send({ name: 'Art' }).expect(403);
    const auth = ctx.app.get(AuthService);
    const outsider = await auth.upsertFromGoogle({ googleId: 'g-out', email: 'out@x.test', name: 'Out' });
    const created = await ctx.http().post('/schools').set('Cookie', ctx.cookieFor(outsider.id)).send({ name: 'Other', city: 'Zahle' }).expect(201);
    const oc = created.headers['set-cookie'][0].split(';')[0];
    await ctx.http().get(`/schools/${school.id}/subjects`).set('Cookie', oc).expect(403);
  });
});
