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
});
