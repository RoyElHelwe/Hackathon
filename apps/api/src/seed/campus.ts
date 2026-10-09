import { prepareExamOutput } from '@tajriba/shared';
import { examReport, interviewTurn, prepareExam } from '../ai/tasks';
import courseFixtures from '../classroom/fixtures/courses.json';
import { lessonFingerprint } from '../courses/lesson-sync.service';
import type { ClassroomLessonItem } from '../classroom/classroom.provider';
import { Prisma, PrismaClient } from '../generated/prisma/client';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/**
 * Demo state for the Tajriba Campus:
 *  - the 8B Classroom lessons (exactly as lesson sync would create them, so a later sync keeps them);
 *  - "Geometry voice check-in": an OPEN interview exam Lea can take live while Ms. Rana spectates;
 *  - "Angles quick interview": a finished exam with graded interviews waiting for the teacher's approval.
 * Idempotent: all campus activity of the class is removed and recreated.
 */
export async function seedCampus(
  prisma: PrismaClient,
  ctx: { schoolId: string; classId: string; courseId: string; teacherId: string; students: { lea: string; karim: string; omar: string }; now: number },
) {
  const { classId, courseId, now } = ctx;

  // ---------- Lessons (same fingerprint + source ids as LessonSyncService) ----------
  const fixture = courseFixtures.courses.find((c) => c.id === 'fake-8b-math');
  const items = (fixture?.lessons ?? []) as unknown as ClassroomLessonItem[];
  const lessonIds: Record<string, string> = {};
  let position = 0;
  for (const item of [...items].sort((a, b) => a.creationTime.localeCompare(b.creationTime))) {
    const fingerprint = lessonFingerprint(item);
    const lesson = await prisma.lesson.upsert({
      where: { courseId_fingerprint: { courseId, fingerprint } },
      update: { title: item.title, description: item.description ?? '', archivedAt: null, position },
      create: {
        courseId,
        fingerprint,
        kind: item.kind,
        title: item.title,
        description: item.description ?? '',
        materials: item.materials as unknown as Prisma.InputJsonValue,
        position,
        postedAt: new Date(item.creationTime),
      },
    });
    await prisma.lessonSource.upsert({
      where: { classId_classroomItemId: { classId, classroomItemId: item.id } },
      update: { lessonId: lesson.id },
      create: { lessonId: lesson.id, classId, classroomItemId: item.id, classroomUrl: item.alternateLink },
    });
    lessonIds[item.title] = lesson.id;
    position++;
  }
  const lessonList = Object.entries(lessonIds);

  // ---------- Reset campus activity of the class ----------
  const oldExams = await prisma.exam.findMany({ where: { classId }, select: { attempts: { select: { id: true } } } });
  const oldSessions = await prisma.studySession.findMany({ where: { classId }, select: { id: true } });
  const refIds = [...oldExams.flatMap((e) => e.attempts.map((a) => a.id)), ...oldSessions.map((s) => s.id)];
  await prisma.recording.deleteMany({ where: { refId: { in: refIds } } });
  await prisma.sessionEvent.deleteMany({ where: { refId: { in: refIds } } });
  await prisma.exam.deleteMany({ where: { classId } });
  await prisma.studySession.deleteMany({ where: { classId } });
  if (!lessonList.length) return;

  const bankFor = (durationMin: number, titles: string[], count: number) =>
    prepareExamOutput.parse(prepareExam.mock({ subject: 'Mathematics', grade: 8, lessonTitles: titles, content: '', count, durationMin, locale: 'en' }));

  // ---------- Open exam for the live demo ----------
  const open = await prisma.exam.create({
    data: {
      schoolId: ctx.schoolId,
      classId,
      createdById: ctx.teacherId,
      title: 'Geometry voice check-in',
      locale: 'en',
      durationMin: 5,
      opensAt: new Date(now - 60 * MIN),
      closesAt: new Date(now + 7 * DAY),
      status: 'OPEN',
      questionBank: bankFor(5, lessonList.map(([t]) => t), 3) as Prisma.InputJsonValue,
      lessons: { create: lessonList.map(([, id]) => ({ lessonId: id })) },
    },
  });
  let room = 1;
  for (const sid of [ctx.students.karim, ctx.students.lea, ctx.students.omar]) {
    await prisma.examAttempt.create({ data: { examId: open.id, studentId: sid, roomIndex: room++ } });
  }

  // ---------- Finished exam awaiting the teacher's approval ----------
  const [firstTitle, firstId] = lessonList[0];
  const doneBank = bankFor(5, [firstTitle], 3);
  const done = await prisma.exam.create({
    data: {
      schoolId: ctx.schoolId,
      classId,
      createdById: ctx.teacherId,
      title: 'Angles quick interview',
      locale: 'en',
      durationMin: 5,
      opensAt: new Date(now - 3 * DAY),
      closesAt: new Date(now - 1 * DAY),
      status: 'CLOSED',
      questionBank: doneBank as Prisma.InputJsonValue,
      lessons: { create: [{ lessonId: firstId }] },
    },
  });
  const answers: Record<string, string[]> = {
    karim: [
      'An angle is made by two rays that start from the same point, and we measure how open it is in degrees with a protractor.',
      'A ramp at school is an angle with the floor. If the angle is small the ramp is safe for wheelchairs, if it is big it is too steep.',
      'People forget to put the centre of the protractor on the vertex, so the reading is wrong. I always line up one ray with zero first.',
    ],
    lea: ['Um, it is when two lines meet?', 'I think the door when it opens makes an angle, like ninety degrees when it is half open, no wait, when it is wide.', "I'm not sure, maybe reading the wrong scale."],
  };
  room = 1;
  for (const [handle, sid] of [['karim', ctx.students.karim], ['lea', ctx.students.lea], ['omar', ctx.students.omar]] as const) {
    const startedAt = new Date(now - 2 * DAY - (room + 1) * 30 * MIN);
    if (handle === 'omar') {
      await prisma.examAttempt.create({ data: { examId: done.id, studentId: sid, roomIndex: room++, status: 'MISSED' } });
      continue;
    }
    const att = await prisma.examAttempt.create({
      data: { examId: done.id, studentId: sid, roomIndex: room++, status: 'IN_PROGRESS', startedAt, endsAt: new Date(startedAt.getTime() + 5 * MIN) },
    });
    const turns: Prisma.ExamTurnCreateManyInput[] = [];
    let idx = 0;
    let t = startedAt.getTime();
    turns.push({ attemptId: att.id, idx: idx++, role: 'AI', text: `Hi! I'm Bousla 👋 Ready? Here's the first one: ${doneBank.questions[0].text}`, emoji: '👋', mood: 'calm', questionId: 'q1', at: new Date(t) });
    const reportTurns: { role: 'AI' | 'STUDENT'; text: string; questionId: string; score: number | null }[] = [];
    doneBank.questions.forEach((q, qi) => {
      const answer = answers[handle][qi];
      const out = interviewTurn.mock({ locale: 'en', subject: 'Mathematics', question: q, answer, recentTurns: [], followUpsUsed: 1, maxFollowUps: 1, isLastQuestion: qi === doneBank.questions.length - 1, secondsLeft: 200 });
      t += 70_000;
      turns.push({ attemptId: att.id, idx: idx++, role: 'STUDENT', text: answer, questionId: q.id, eval: out.assessment, mood: out.mood, at: new Date(t) });
      reportTurns.push({ role: 'STUDENT', text: answer, questionId: q.id, score: out.assessment.score });
      const next = doneBank.questions[qi + 1];
      t += 5_000;
      turns.push({
        attemptId: att.id,
        idx: idx++,
        role: 'AI',
        text: next ? `${out.reaction} ${next.text}` : `${out.reaction} That's all my questions! You did great. 🎉`,
        emoji: next ? out.emoji : '🎉',
        mood: out.mood,
        questionId: next?.id ?? null,
        at: new Date(t),
      });
    });
    await prisma.examTurn.createMany({ data: turns });
    const report = examReport.mock({ locale: 'en', subject: 'Mathematics', questions: doneBank.questions, turns: reportTurns, finishReason: 'COMPLETED' });
    await prisma.examAttempt.update({
      where: { id: att.id },
      data: { status: 'GRADED', finishedAt: new Date(t), finishReason: 'COMPLETED', questionIdx: doneBank.questions.length - 1, aiScore: report.score, aiReport: report as Prisma.InputJsonValue },
    });
  }
}
