import { LessonContentService } from '../src/courses/lesson-content.service';
import { LessonGamifyService } from '../src/courses/lesson-gamify.service';
import { createTestApp, TestCtx } from './app';

describe('gamify a course lesson (integration)', () => {
  let ctx: TestCtx;
  let gamify: LessonGamifyService;
  let courseId: string;
  let ranaId: string;
  let lessonIds: string[];
  let sectionIds: string[];

  beforeAll(async () => {
    ctx = await createTestApp();
    gamify = ctx.app.get(LessonGamifyService);
    const school = await ctx.prisma.school.findUniqueOrThrow({ where: { schoolCode: 'TRP-2036' } });
    const math = await ctx.prisma.subject.findFirstOrThrow({ where: { schoolId: school.id, key: 'math' } });
    courseId = (await ctx.prisma.course.findUniqueOrThrow({ where: { schoolId_subjectId_gradeLevel: { schoolId: school.id, subjectId: math.id, gradeLevel: 8 } } })).id;
    ranaId = (await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'rana' } })).id;
    // Grade 8 · Math gets a second section (8A); the import also syncs the course's lessons.
    await ctx.http()
      .post('/classroom/import')
      .set('Cookie', await ctx.as('rana'))
      .send({ items: [{ courseId: 'fake-8a-math', subjectId: math.id, gradeLevel: 8, sectionLabel: 'A' }] })
      .expect(201);
    const lessons = await ctx.prisma.lesson.findMany({ where: { courseId, archivedAt: null }, orderBy: { position: 'asc' } });
    lessonIds = lessons.map((l) => l.id);
    sectionIds = (await ctx.prisma.class.findMany({ where: { courseId } })).map((c) => c.id);
  });
  afterAll(async () => {
    await gamify.idle();
    await ctx.app.close();
  });

  it('reads Drive text for a lesson (fake Drive)', async () => {
    const c = await ctx.app.get(LessonContentService).collect(lessonIds[0]);
    expect(c.text).toContain('# Lesson: Areas of triangles');
    expect(c.text).toContain('half of the base times the height');
    expect(c.text).toContain('## Video: Area of a triangle');
    expect(c.unreadable).toEqual([]);
  });

  it('creates a course skill + DRAFT templates, chained in Classroom post order', async () => {
    expect(sectionIds).toHaveLength(2);
    await gamify.run(lessonIds[0], { teacherId: ranaId });
    await gamify.run(lessonIds[1], { teacherId: ranaId });

    const l0 = await ctx.prisma.lesson.findUniqueOrThrow({ where: { id: lessonIds[0] }, include: { topic: { include: { missions: true, prerequisites: true } } } });
    expect(l0.status).toBe('READY');
    expect(l0.topic).toMatchObject({ courseId, lessonId: lessonIds[0], key: `l_${lessonIds[0]}`, gradeLevel: 8 });
    expect(l0.topic!.missions).toHaveLength(2);
    expect(l0.topic!.missions.every((m) => m.status === 'DRAFT' && m.classId === null && m.courseId === courseId && m.aiGenerated)).toBe(true);
    expect(l0.topic!.prerequisites).toEqual([]);

    const t1 = await ctx.prisma.topic.findUniqueOrThrow({ where: { lessonId: lessonIds[1] }, include: { prerequisites: true } });
    expect(t1.prerequisites.map((p) => p.prerequisiteId)).toEqual([l0.topic!.id]);

    const rana = await ctx.as('rana');
    const lessons = (await ctx.http().get(`/courses/${courseId}/lessons`).set('Cookie', rana).expect(200)).body;
    expect(lessons[0]).toMatchObject({ status: 'READY', topic: { id: l0.topic!.id }, draftCount: 2, approvedCount: 0, gamifyError: null });
    expect(lessons[2]).toMatchObject({ status: 'NOT_GAMIFIED', topic: null, draftCount: 0 });
    const templates = (await ctx.http().get(`/missions?courseId=${courseId}`).set('Cookie', rana).expect(200)).body;
    expect(templates).toHaveLength(4);
    await ctx.http().get(`/missions/${templates[0].id}`).set('Cookie', rana).expect(200);
    // Students never see templates.
    await ctx.http().get(`/missions/${templates[0].id}`).set('Cookie', await ctx.as('lea')).expect(403);
  });

  it('approving a template publishes one copy per section (Classroom + students of both sections)', async () => {
    const rana = await ctx.as('rana');
    const topic = await ctx.prisma.topic.findUniqueOrThrow({ where: { lessonId: lessonIds[0] } });
    const draft = await ctx.prisma.mission.findFirstOrThrow({ where: { topicId: topic.id, status: 'DRAFT' }, orderBy: { createdAt: 'asc' } });
    const r = (await ctx.http().post(`/missions/${draft.id}/approve`).set('Cookie', rana).send({ postToClassroom: true }).expect(201)).body;
    expect(r.mission.status).toBe('APPROVED');
    expect(r.classroom).toMatchObject({ posted: true });

    const copies = await ctx.prisma.mission.findMany({ where: { parentMissionId: draft.id } });
    expect(copies.map((c) => c.classId).sort()).toEqual([...sectionIds].sort());
    expect(copies.every((c) => c.status === 'APPROVED' && c.courseId === courseId && c.classroomCourseWorkId)).toBe(true);
    expect(ctx.fake.courseWork.map((w) => w.courseId).sort()).toEqual(['fake-8a-math', 'fake-8b-math']);

    const leaMissions = (await ctx.http().get('/missions').set('Cookie', await ctx.as('lea')).expect(200)).body;
    expect(leaMissions.some((m: { parentMissionId: string }) => m.parentMissionId === draft.id)).toBe(true);
    const eightA = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'fake-8a-01' } });
    const aMissions = (await ctx.http().get('/missions').set('Cookie', ctx.cookieFor(eightA.id)).expect(200)).body;
    expect(aMissions.filter((m: { parentMissionId: string }) => m.parentMissionId === draft.id)).toHaveLength(1);
  });

  it('regenerate replaces drafts only; the approved template and its copies stay', async () => {
    const topic = await ctx.prisma.topic.findUniqueOrThrow({ where: { lessonId: lessonIds[0] } });
    const before = await ctx.prisma.mission.findMany({ where: { topicId: topic.id, classId: null } });
    const approved = before.find((m) => m.status === 'APPROVED')!;
    const oldDraft = before.find((m) => m.status === 'DRAFT')!;

    await gamify.run(lessonIds[0], { teacherId: ranaId });
    const after = await ctx.prisma.mission.findMany({ where: { topicId: topic.id, classId: null } });
    expect(after.find((m) => m.id === approved.id)?.status).toBe('APPROVED');
    expect(after.some((m) => m.id === oldDraft.id)).toBe(false);
    expect(after.filter((m) => m.status === 'DRAFT')).toHaveLength(2);
    expect(await ctx.prisma.mission.count({ where: { parentMissionId: approved.id, status: 'APPROVED' } })).toBe(2);
    expect((await ctx.prisma.topic.findUniqueOrThrow({ where: { lessonId: lessonIds[0] } })).id).toBe(topic.id);
  });

  it('POST /lessons/:id/gamify answers 202 and works in the background; students get 403; 409 while running', async () => {
    await ctx.http().post(`/lessons/${lessonIds[2]}/gamify`).set('Cookie', await ctx.as('lea')).expect(403);
    const res = await ctx.http().post(`/lessons/${lessonIds[2]}/gamify`).set('Cookie', await ctx.as('rana')).send({}).expect(202);
    expect(res.body).toEqual({ status: 'GAMIFYING' });
    await gamify.idle();
    const l2 = await ctx.prisma.lesson.findUniqueOrThrow({ where: { id: lessonIds[2] }, include: { topic: true } });
    expect(l2.status).toBe('READY');
    expect(l2.topic).not.toBeNull();

    await ctx.prisma.lesson.update({ where: { id: lessonIds[2] }, data: { status: 'GAMIFYING' } });
    await ctx.http().post(`/lessons/${lessonIds[2]}/gamify`).set('Cookie', await ctx.as('rana')).expect(409);
  });
});
