import { LessonGamifyService } from '../src/courses/lesson-gamify.service';
import { createTestApp, TestCtx } from './app';

describe('real data everywhere (integration)', () => {
  let ctx: TestCtx;
  let schoolId: string;
  let physics: { id: string; key: string };
  let sectionId: string;
  let courseId: string;
  let skillId: string;
  let student: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const gamify = ctx.app.get(LessonGamifyService);
    schoolId = (await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } })).id;
    const director = await ctx.as('director');
    const rana = await ctx.as('rana');
    physics = (await ctx.http().post(`/schools/${schoolId}/subjects`).set('Cookie', director).send({ name: 'Applied Physics', color: 'sky', icon: 'zap' }).expect(201)).body;

    // 9A Science → Grade 9 · Applied Physics, with one posted lesson.
    ctx.fake.courses.find((c) => c.id === 'fake-9a-science')!.lessons = [
      {
        id: '9a-item-1',
        kind: 'MATERIAL',
        title: 'Forces and motion',
        description: 'Push, pull and friction.',
        materials: [{ type: 'link', title: 'Forces', url: 'https://example.org/forces' }],
        alternateLink: null,
        creationTime: '2026-09-20T09:00:00.000Z',
      },
    ];
    const imported = (
      await ctx.http()
        .post('/classroom/import')
        .set('Cookie', rana)
        .send({ items: [{ courseId: 'fake-9a-science', subjectId: physics.id, gradeLevel: 9, sectionLabel: 'A' }] })
        .expect(201)
    ).body;
    sectionId = imported[0].classId;
    courseId = imported[0].courseId;
    const lesson = await ctx.prisma.lesson.findFirstOrThrow({ where: { courseId } });
    const ranaId = (await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'rana' } })).id;
    await gamify.run(lesson.id, { teacherId: ranaId });
    const topic = await ctx.prisma.topic.findUniqueOrThrow({ where: { lessonId: lesson.id } });
    skillId = topic.id;
    const draft = await ctx.prisma.mission.findFirstOrThrow({ where: { topicId: topic.id, status: 'DRAFT' } });
    await ctx.http().post(`/missions/${draft.id}/approve`).set('Cookie', rana).send({ postToClassroom: false }).expect(201);
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'fake-9a-01' } });
    student = ctx.cookieFor(u.id);
  });
  afterAll(async () => ctx.app.close());

  it('a student only in a gamified Physics course sees only Physics and only that course skill', async () => {
    const subjects = (await ctx.http().get('/subjects').set('Cookie', student).expect(200)).body;
    expect(subjects.map((s: { key: string }) => s.key)).toEqual([physics.key]);
    expect(subjects[0].topicCount).toBe(1);

    const graph = (await ctx.http().get(`/subjects/${physics.key}/graph`).set('Cookie', student).expect(200)).body;
    expect(graph.nodes.map((n: { id: string }) => n.id)).toEqual([skillId]);
    expect(graph.nodes[0].missions).toHaveLength(1);
    expect(graph.edges).toEqual([]);
    // Math is a school subject, but none of this student's sections show it.
    const math = (await ctx.http().get('/subjects/math/graph').set('Cookie', student).expect(200)).body;
    expect(math.nodes).toEqual([]);
    // Subjects of other schools are not found.
    await ctx.http().get('/subjects/nope-subject/graph').set('Cookie', student).expect(404);
  });

  it('teacher dashboard: heatmap topics = course skills; a section without subject has no topics (no math fallback)', async () => {
    const rana = await ctx.as('rana');
    const dash = (await ctx.http().get(`/dashboards/teacher/${sectionId}`).set('Cookie', rana).expect(200)).body;
    expect(dash.topics.map((t: { id: string }) => t.id)).toEqual([skillId]);
    expect(dash.topics[0]).toMatchObject({ subjectKey: physics.key, color: 'sky', courseId });

    const ranaId = (await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'rana' } })).id;
    const bare = await ctx.prisma.class.create({ data: { schoolId, name: 'Club', teachers: { create: { teacherId: ranaId, type: 'OWNER' } } } });
    const empty = (await ctx.http().get(`/dashboards/teacher/${bare.id}`).set('Cookie', rana).expect(200)).body;
    expect(empty.topics).toEqual([]);
    expect(empty.stats.avgMastery).toBe(0);
  });

  it('demo golden path: Lea still sees the Math geometry map (and no other subject)', async () => {
    const lea = await ctx.as('lea');
    const subjects = (await ctx.http().get('/subjects').set('Cookie', lea).expect(200)).body;
    expect(subjects.map((s: { key: string }) => s.key)).toEqual(['math']);
    const graph = (await ctx.http().get('/subjects/math/graph').set('Cookie', lea).expect(200)).body;
    const keys = graph.nodes.map((n: { key: string }) => n.key);
    expect(keys).toEqual(expect.arrayContaining(['geo.area', 'geo.angles', 'geo.similar', 'geo.pythagoras']));
    expect(graph.nodes.find((n: { key: string }) => n.key === 'geo.similar').state).toBe('AVAILABLE');
  });

  it('director coverage lists only the school courses and their skills', async () => {
    const director = await ctx.as('director');
    const body = (await ctx.http().get(`/dashboards/director/${schoolId}`).set('Cookie', director).expect(200)).body;
    const courses = await ctx.prisma.course.findMany({ where: { schoolId } });
    expect(body.coverage.map((c: { courseId: string }) => c.courseId).sort()).toEqual(courses.map((c) => c.id).sort());
    const phys = body.coverage.find((c: { courseId: string }) => c.courseId === courseId);
    expect(phys.topics.map((t: { topicId: string }) => t.topicId)).toEqual([skillId]);
    expect(phys.sections.map((s: { id: string }) => s.id)).toEqual([sectionId]);
    const keys = body.coverage.flatMap((c: { topics: { topicKey: string }[] }) => c.topics.map((t) => t.topicKey));
    expect(keys).not.toContain('phy.speed');
    expect(keys).toContain('geo.area');
  });
});
