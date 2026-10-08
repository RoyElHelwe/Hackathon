import { ClassroomService } from '../src/classroom/classroom.service';
import { createTestApp, TestCtx } from './app';

describe('roster sync & co-teachers (integration)', () => {
  let ctx: TestCtx;
  let classroom: ClassroomService;
  let classId: string;
  beforeAll(async () => {
    ctx = await createTestApp();
    classroom = ctx.app.get(ClassroomService);
    classId = (await ctx.prisma.class.findUniqueOrThrow({ where: { classroomCourseId: 'fake-8b-math' } })).id;
  });
  afterAll(async () => ctx.app.close());

  const course = () => ctx.fake.courses.find((c) => c.id === 'fake-8b-math')!;

  it('adds new students', async () => {
    course().students.push({ userId: 'g-new-kid', name: 'New Kid', email: 'newkid@students.test' });
    const r = await classroom.syncClass(classId);
    expect(r).toMatchObject({ added: 1, archived: 0, total: 4 });
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'g-new-kid' } });
    expect(u.status).toBe('INVITED');
  });

  it('archives removed students (never deletes, progress kept)', async () => {
    const omar = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'omar' } });
    const before = await ctx.prisma.topicProgress.count({ where: { studentId: omar.id } });
    course().students = course().students.filter((s) => s.userId !== 'seed-omar');
    const r = await classroom.syncClass(classId);
    expect(r.archived).toBe(1);
    const enr = await ctx.prisma.enrollment.findUniqueOrThrow({ where: { classId_studentId: { classId, studentId: omar.id } } });
    expect(enr.status).toBe('ARCHIVED');
    expect(await ctx.prisma.topicProgress.count({ where: { studentId: omar.id } })).toBe(before);
  });

  it('re-adds a student who comes back', async () => {
    course().students.push({ userId: 'seed-omar', name: 'Omar Tannous', email: 'omar@students.tripoli-future.school' });
    const r = await classroom.syncClass(classId);
    expect(r.added).toBe(1);
    const omar = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'omar' } });
    expect((await ctx.prisma.enrollment.findUniqueOrThrow({ where: { classId_studentId: { classId, studentId: omar.id } } })).status).toBe('ACTIVE');
  });

  it('matches by email when the Google id is unknown (no duplicate person)', async () => {
    await ctx.prisma.user.create({ data: { googleId: 'legacy-id', email: 'emailmatch@students.test', name: 'Email Match' } });
    course().students.push({ userId: 'g-classroom-id', name: 'Email Match', email: 'emailmatch@students.test' });
    await classroom.syncClass(classId);
    expect(await ctx.prisma.user.count({ where: { email: 'emailmatch@students.test' } })).toBe(1);
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'emailmatch@students.test' } });
    expect(await ctx.prisma.enrollment.findUnique({ where: { classId_studentId: { classId, studentId: u.id } } })).not.toBeNull();
  });

  it('same course imported by a second teacher → one class, CO_TEACHER', async () => {
    const hassan = await ctx.as('hassan');
    const hassanUser = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'hassan' } });
    course().teacherGoogleIds.push('seed-hassan');
    const r = (await ctx.http().post('/classroom/import').set('Cookie', hassan).send({ courseIds: ['fake-8b-math'] }).expect(201)).body;
    expect(r[0].classId).toBe(classId);
    expect(await ctx.prisma.class.count({ where: { classroomCourseId: 'fake-8b-math' } })).toBe(1);
    const link = await ctx.prisma.classTeacher.findUniqueOrThrow({ where: { classId_teacherId: { classId, teacherId: hassanUser.id } } });
    expect(link.type).toBe('CO_TEACHER');
    await ctx.http().get(`/dashboards/teacher/${classId}`).set('Cookie', hassan).expect(200);
  });

  it('student in many classes = one user, many enrollments', async () => {
    const lea = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } });
    const other = await ctx.prisma.class.create({ data: { schoolId: (await ctx.prisma.school.findFirstOrThrow()).id, name: '8B Science' } });
    await ctx.prisma.enrollment.create({ data: { classId: other.id, studentId: lea.id } });
    expect(await ctx.prisma.enrollment.count({ where: { studentId: lea.id } })).toBe(2);
    expect(await ctx.prisma.user.count({ where: { googleId: 'seed-lea' } })).toBe(1);
  });

  it('expired token → class flagged "Reconnect Google Classroom"', async () => {
    ctx.fake.revoked.add('seed-rana');
    const r = await classroom.syncClass(classId);
    expect(r.reconnect).toBe(true);
    const rana = await ctx.as('rana');
    const classes = (await ctx.http().get('/classes').set('Cookie', rana).expect(200)).body;
    expect(classes.find((c: { id: string }) => c.id === classId).syncError).toBe('RECONNECT');
    ctx.fake.revoked.clear();
    await ctx.http().get('/classroom/connect').set('Cookie', rana).expect(302);
    expect((await ctx.prisma.class.findUniqueOrThrow({ where: { id: classId } })).syncError).toBeNull();
  });

  it('grade sync failure keeps the grade and retries on the next sync', async () => {
    const lea = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } });
    const rana = await ctx.as('rana');
    const mission = await ctx.prisma.mission.findUniqueOrThrow({ where: { key: 'm.similar.shadows' } });
    const sub = await ctx.prisma.submission.create({
      data: { missionId: mission.id, studentId: lea.id, status: 'TEACHER_REVIEW', photoUploadIds: [], aiCheck: { score: 80, correct: true, perCriterion: [], feedback: '', followUpQuestion: '', flags: [] }, submittedAt: new Date() },
    });
    ctx.fake.failGrades = true;
    const reviewed = (await ctx.http().post(`/submissions/${sub.id}/teacher-review`).set('Cookie', rana).send({ score: 88 }).expect(201)).body;
    expect(reviewed.status).toBe('VALIDATED');
    expect(reviewed.finalScore).toBe(88);
    expect(reviewed.gradeSynced).toBe(false);
    const queue = (await ctx.http().get('/teacher/review-queue').set('Cookie', rana).expect(200)).body;
    expect(queue.find((q: { id: string }) => q.id === sub.id).gradeSyncPending).toBe(true);
    ctx.fake.failGrades = false;
    await classroom.syncClass(classId);
    expect((await ctx.prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).gradeSynced).toBe(true);
  });
});
