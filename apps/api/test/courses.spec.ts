import { heuristicParseCourses } from '../src/ai/tasks';
import { config } from '../src/config';
import { createTestApp, TestCtx } from './app';

interface Suggestion {
  subjectId: string | null;
  gradeLevel: number | null;
  sectionLabel: string | null;
  courseId: string | null;
}

describe('courses: smart import + lesson sync (integration)', () => {
  let ctx: TestCtx;
  let mathId: string;
  let grade8Id: string;
  beforeAll(async () => {
    ctx = await createTestApp();
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    mathId = (await ctx.prisma.subject.findFirstOrThrow({ where: { schoolId: school.id, key: 'math' } })).id;
    grade8Id = (await ctx.prisma.course.findUniqueOrThrow({ where: { schoolId_subjectId_gradeLevel: { schoolId: school.id, subjectId: mathId, gradeLevel: 8 } } })).id;
  });
  afterAll(async () => ctx.app.close());

  it('heuristic reads English, Arabic and French course names', () => {
    const subjects = [{ id: 'm', name: 'Mathematics | الرياضيات' }];
    const r = heuristicParseCourses({
      subjects,
      courses: [
        { id: '1', name: 'Maths 6ème B', section: '' },
        { id: '2', name: 'Grade 6 – Math – B', section: '' },
        { id: '3', name: 'رياضيات السادس ج', section: '' },
        { id: '4', name: 'Art club', section: '' },
      ],
    }).items;
    expect(r.slice(0, 3).map((i) => [i.subjectId, i.gradeLevel, i.sectionLabel])).toEqual([
      ['m', 6, 'B'],
      ['m', 6, 'B'],
      ['m', 6, 'C'],
    ]);
    expect(r[3]).toMatchObject({ subjectId: null, gradeLevel: null });
  });

  it('GET /classroom/courses suggests subject + grade and groups 6A/6B into one proposed course', async () => {
    const hassan = await ctx.as('hassan');
    const body = (await ctx.http().get('/classroom/courses').set('Cookie', hassan).expect(200)).body;
    const s = (id: string): Suggestion => body.courses.find((c: { id: string }) => c.id === id).suggestion;
    expect(s('fake-6a-math')).toEqual({ subjectId: mathId, gradeLevel: 6, sectionLabel: 'A', courseId: null });
    expect(s('fake-6b-math')).toEqual({ subjectId: mathId, gradeLevel: 6, sectionLabel: 'B', courseId: null });
    expect(s('fake-8a-math')).toMatchObject({ subjectId: mathId, gradeLevel: 8, sectionLabel: 'A', courseId: grade8Id });
    expect(body.subjects.map((x: { id: string }) => x.id)).toContain(mathId);
    expect(body.schoolCourses).toHaveLength(3);
  });

  it('POST /classroom/import with items → one course, two sections, shared lesson deduped', async () => {
    const hassan = await ctx.as('hassan');
    const items = [
      { courseId: 'fake-6a-math', subjectId: mathId, gradeLevel: 6, sectionLabel: 'A' },
      { courseId: 'fake-6b-math', subjectId: mathId, gradeLevel: 6, sectionLabel: 'B' },
    ];
    const res = (await ctx.http().post('/classroom/import').set('Cookie', hassan).send({ items }).expect(201)).body;
    expect(res).toHaveLength(2);
    expect(res[0].courseId).toBeTruthy();
    expect(res[1].courseId).toBe(res[0].courseId);
    const course = await ctx.prisma.course.findUniqueOrThrow({ where: { id: res[0].courseId }, include: { classes: true, lessons: { include: { sources: true } } } });
    expect(course).toMatchObject({ subjectId: mathId, gradeLevel: 6 });
    expect(course.classes.map((c) => c.sectionLabel).sort()).toEqual(['A', 'B']);
    expect(course.lessons).toHaveLength(1);
    expect(course.lessons[0].sources).toHaveLength(2);

    const mine = (await ctx.http().get('/courses').set('Cookie', hassan).expect(200)).body;
    const six = mine.find((c: { id: string }) => c.id === course.id);
    expect(six).toMatchObject({ gradeLevel: 6, lessonCount: 1, sectionCount: 2, canEdit: true });
    expect(six.subject.id).toBe(mathId);
  });

  it('lesson sync merges sections, skips Tajriba posts, orders by first post, archives removed posts', async () => {
    const rana = await ctx.as('rana');
    await ctx.http()
      .post('/classroom/import')
      .set('Cookie', rana)
      .send({ items: [{ courseId: 'fake-8a-math', subjectId: mathId, gradeLevel: 8, sectionLabel: 'A' }] })
      .expect(201);
    // A mission Tajriba posted to Classroom must not come back as a lesson.
    ctx.fake.courseWork.push({ id: 'cw-tajriba', courseId: 'fake-8b-math', input: { title: 'Tajriba mission', description: '', link: `${config.WEB_URL}/missions/x` } });

    const r = (await ctx.http().post(`/courses/${grade8Id}/sync`).set('Cookie', rana).expect(201)).body;
    expect(r).toMatchObject({ lessons: 3, archived: 0, reconnect: false });
    const lessons = (await ctx.http().get(`/courses/${grade8Id}/lessons`).set('Cookie', rana).expect(200)).body;
    expect(lessons.map((l: { title: string }) => l.title)).toEqual(['Areas of triangles', 'Angles worksheet', 'Similar triangles slides']);
    expect(lessons.map((l: { position: number }) => l.position)).toEqual([0, 1, 2]);
    expect(lessons.map((l: { sources: unknown[] }) => l.sources.length)).toEqual([2, 2, 1]);
    expect(lessons[1]).toMatchObject({ kind: 'ASSIGNMENT', status: 'NOT_GAMIFIED' });
    expect(lessons[0].materials.map((m: { type: string }) => m.type)).toEqual(['drive', 'youtube']);

    const eightA = ctx.fake.courses.find((c) => c.id === 'fake-8a-math')!;
    const removed = eightA.lessons!.pop()!;
    const r2 = (await ctx.http().post(`/courses/${grade8Id}/sync`).set('Cookie', rana).expect(201)).body;
    expect(r2).toMatchObject({ lessons: 2, archived: 1, added: 0 });
    expect((await ctx.http().get(`/courses/${grade8Id}/lessons`).set('Cookie', rana).expect(200)).body).toHaveLength(2);
    expect(await ctx.prisma.lesson.count({ where: { courseId: grade8Id, archivedAt: { not: null } } })).toBe(1);

    eightA.lessons!.push(removed);
    const r3 = (await ctx.http().post(`/courses/${grade8Id}/sync`).set('Cookie', rana).expect(201)).body;
    expect(r3).toMatchObject({ lessons: 3, added: 0 });
    expect(await ctx.prisma.lesson.count({ where: { courseId: grade8Id } })).toBe(3);
  });

  it('students read only courses of their own sections', async () => {
    const lea = await ctx.as('lea');
    const got = (await ctx.http().get(`/courses/${grade8Id}`).set('Cookie', lea).expect(200)).body;
    expect(got).toMatchObject({ id: grade8Id, canEdit: false });
    await ctx.http().post(`/courses/${grade8Id}/sync`).set('Cookie', lea).expect(403);

    const sixA = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'fake-6a-01' } });
    const c6 = ctx.cookieFor(sixA.id);
    await ctx.http().get(`/courses/${grade8Id}`).set('Cookie', c6).expect(403);
    await ctx.http().get(`/courses/${grade8Id}/lessons`).set('Cookie', c6).expect(403);
    const mine = (await ctx.http().get('/courses').set('Cookie', c6).expect(200)).body;
    expect(mine).toHaveLength(1);
    expect(mine[0].gradeLevel).toBe(6);
  });

  it('PATCH /classes/:id/course moves a section; subject delete is blocked while courses use it', async () => {
    const hassan = await ctx.as('hassan');
    const nine = await ctx.prisma.class.findFirstOrThrow({ where: { name: '9B Math' } });
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    const phys = await ctx.prisma.subject.findFirstOrThrow({ where: { schoolId: school.id, key: 'physics' } });
    const r = (await ctx.http().patch(`/classes/${nine.id}/course`).set('Cookie', hassan).send({ subjectId: phys.id, gradeLevel: 9, sectionLabel: 'b' }).expect(200)).body;
    const moved = await ctx.prisma.class.findUniqueOrThrow({ where: { id: nine.id } });
    expect(moved).toMatchObject({ courseId: r.courseId, subjectId: phys.id, gradeLevel: 9, sectionLabel: 'B' });
    // Rana does not teach 9B.
    await ctx.http().patch(`/classes/${nine.id}/course`).set('Cookie', await ctx.as('rana')).send({ subjectId: mathId, gradeLevel: 9 }).expect(403);

    const dir = await ctx.as('director');
    await ctx.prisma.class.update({ where: { id: nine.id }, data: { subjectId: null } });
    const del = await ctx.http().delete(`/schools/${school.id}/subjects/${phys.id}`).set('Cookie', dir).expect(409);
    expect(del.body.message).toMatch(/^Courses still use this subject/);
  });
});
