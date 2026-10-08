import { AuthService } from '../src/auth/auth.service';
import { createTestApp, TestCtx } from './app';

describe('onboarding (integration)', () => {
  let ctx: TestCtx;
  beforeAll(async () => {
    ctx = await createTestApp({ seed: false });
  });
  afterAll(async () => ctx.app.close());

  it('director creates school → teacher joins by code → approved → imports class → student signs in and sees it', async () => {
    const auth = ctx.app.get(AuthService);
    const dir = await auth.upsertFromGoogle({ googleId: 'g-dir', email: 'dir@school.test', name: 'Dana Director' });
    const dirCookie = ctx.cookieFor(dir.id);
    const me0 = (await ctx.http().get('/me').set('Cookie', dirCookie).expect(200)).body;
    expect(me0.active).toBeNull();
    expect(me0.home).toBe('/onboarding');

    const created = await ctx.http().post('/schools').set('Cookie', dirCookie).send({ name: 'Byblos Hills School', city: 'Byblos', gradeLevels: [8] }).expect(201);
    expect(created.body.schoolCode).toMatch(/^[A-Z]{3}-\d{4}$/);
    const dirSession = created.headers['set-cookie'][0].split(';')[0];

    // Teacher joins with the school code → PENDING
    const teacher = await auth.upsertFromGoogle({ googleId: 'g-teacher', email: 'teach@school.test', name: 'Tarek Teacher' });
    const tCookie = ctx.cookieFor(teacher.id);
    const joined = (await ctx.http().post('/schools/join').set('Cookie', tCookie).send({ code: created.body.schoolCode }).expect(201)).body;
    expect(joined.membership.status).toBe('PENDING');
    await ctx.http().get('/classes').set('Cookie', tCookie).expect(403);

    // Director sees and approves
    const pending = (await ctx.http().get(`/schools/${created.body.id}/members?status=PENDING`).set('Cookie', dirSession).expect(200)).body;
    expect(pending).toHaveLength(1);
    await ctx.http().post(`/memberships/${pending[0].id}/approve`).set('Cookie', dirSession).expect(201);

    // Connect Classroom (fake) → list → import 8A
    await ctx.http().get('/classroom/connect').set('Cookie', tCookie).expect(302);
    const courses = (await ctx.http().get('/classroom/courses').set('Cookie', tCookie).expect(200)).body;
    expect(courses.connected).toBe(true);
    expect(courses.courses.map((c: { id: string }) => c.id)).toContain('fake-8a-math');
    const imported = (await ctx.http().post('/classroom/import').set('Cookie', tCookie).send({ courseIds: ['fake-8a-math'] }).expect(201)).body;
    expect(imported[0]).toMatchObject({ name: '8A Math', added: 24, total: 24 });

    // Student signs in with Google: matched by googleId, INVITED → ACTIVE, class already there
    const pre = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'fake-8a-01' } });
    expect(pre.status).toBe('INVITED');
    const student = await auth.upsertFromGoogle({ googleId: 'fake-8a-01', email: pre.email, name: 'Ahmad Saad' });
    expect(student.id).toBe(pre.id);
    expect(student.status).toBe('ACTIVE');
    const sCookie = ctx.cookieFor(student.id);
    const me = (await ctx.http().get('/me').set('Cookie', sCookie).expect(200)).body;
    expect(me.active.role).toBe('STUDENT');
    expect(me.home).toBe('/student');
    const classes = (await ctx.http().get('/classes').set('Cookie', sCookie).expect(200)).body;
    expect(classes.map((c: { name: string }) => c.name)).toEqual(['8A Math']);
  });

  it('wrong school join stays PENDING and the director can reject', async () => {
    const auth = ctx.app.get(AuthService);
    const school = await ctx.prisma.school.findFirstOrThrow();
    const dirM = await ctx.prisma.membership.findFirstOrThrow({ where: { role: 'DIRECTOR' } });
    const u = await auth.upsertFromGoogle({ googleId: 'g-wrong', email: 'wrong@school.test', name: 'Wrong Person' });
    const j = (await ctx.http().post('/schools/join').set('Cookie', ctx.cookieFor(u.id)).send({ code: school.schoolCode }).expect(201)).body;
    await ctx.http().post(`/memberships/${j.membership.id}/reject`).set('Cookie', ctx.cookieFor(dirM.userId)).expect(201);
    const me = (await ctx.http().get('/me').set('Cookie', ctx.cookieFor(u.id)).expect(200)).body;
    expect(me.active).toBeNull();
    expect(me.memberships[0].status).toBe('REJECTED');
  });

  it('duplicate Google login is impossible: same googleId → same user', async () => {
    const auth = ctx.app.get(AuthService);
    const a = await auth.upsertFromGoogle({ googleId: 'g-dup', email: 'dup@school.test', name: 'Dup' });
    const b = await auth.upsertFromGoogle({ googleId: 'g-dup', email: 'dup@school.test', name: 'Dup' });
    expect(a.id).toBe(b.id);
    await expect(ctx.prisma.user.create({ data: { googleId: 'g-dup', email: 'other@school.test', name: 'X' } })).rejects.toThrow();
  });

  it('one user, two roles: teacher who is also a parent can switch', async () => {
    const teacherUser = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'g-teacher' } });
    const student = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'fake-8a-02' } });
    const code = (await ctx.http().post('/families/code').set('Cookie', ctx.cookieFor(student.id)).expect(201)).body.code;
    await ctx.http().post('/families/link').set('Cookie', ctx.cookieFor(teacherUser.id)).send({ code }).expect(201);
    const me = (await ctx.http().get('/me').set('Cookie', ctx.cookieFor(teacherUser.id)).expect(200)).body;
    const roles = me.memberships.map((m: { role: string }) => m.role).sort();
    expect(roles).toEqual(['PARENT', 'TEACHER']);
    const parentM = me.memberships.find((m: { role: string }) => m.role === 'PARENT');
    const sw = await ctx.http().post('/me/active-role').set('Cookie', ctx.cookieFor(teacherUser.id)).send({ membershipId: parentM.id }).expect(201);
    expect(sw.body.home).toBe('/parent');
    const cookie = sw.headers['set-cookie'][0].split(';')[0];
    const me2 = (await ctx.http().get('/me').set('Cookie', cookie).expect(200)).body;
    expect(me2.active.role).toBe('PARENT');
    expect(me2.children[0].id).toBe(student.id);
  });
});
