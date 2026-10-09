import { io, Socket } from 'socket.io-client';
import { STUDY_MIN_XP_MS } from '@tajriba/shared';
import { AiService } from '../src/ai/ai.service';
import { config } from '../src/config';
import { LessonContentService } from '../src/courses/lesson-content.service';
import { ExamPrepService } from '../src/exams/exam-prep.service';
import { MAX_RECORDING_BYTES, RecordingsService } from '../src/recordings/recordings.service';
import { ExamRoomService } from '../src/exams/exam-room.service';
import { ExamsService } from '../src/exams/exams.service';
import { CampusGateway } from '../src/realtime/campus.gateway';
import { StudySessionsService } from '../src/study-sessions/study-sessions.service';
import { createTestApp, TestCtx } from './app';

let ctx: TestCtx;
let url: string;
const sockets: Socket[] = [];

function connect(cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { path: '/socket.io', transports: ['websocket'], extraHeaders: { cookie }, reconnection: false, forceNew: true });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
const emit = <T = Record<string, unknown>>(s: Socket, ev: string, body: unknown) => s.timeout(5000).emitWithAck(ev, body) as Promise<T>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  ctx = await createTestApp();
  await ctx.app.listen(0);
  const addr = ctx.app.getHttpServer().address();
  url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  ctx.app.get(CampusGateway).graceMs = 200;
  ctx.app.get(StudySessionsService).inviteGapMs = 0;
});
afterEach(() => {
  for (const s of sockets.splice(0)) s.disconnect();
});
afterAll(async () => {
  await ctx.app.get(ExamPrepService).idle();
  await ctx.app.get(ExamRoomService).idle();
  await ctx.app.close();
});

const userId = async (handle: string) => (await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: handle } })).id;

describe('Peer study sessions', () => {
  let sessionId: string;

  it('lists classmates and invites one', async () => {
    const lea = await ctx.as('lea');
    const mates = (await ctx.http().get('/study-sessions/classmates').set('Cookie', lea).expect(200)).body;
    expect(mates.map((m: { name: string }) => m.name)).toEqual(expect.arrayContaining([expect.stringMatching(/Karim/), expect.stringMatching(/Omar/)]));
    const r = await ctx.http().post('/study-sessions').set('Cookie', lea).send({ partnerId: await userId('karim') }).expect(201);
    sessionId = r.body.id;
    expect(r.body.status).toBe('INVITED');
    const notes = (await ctx.http().get('/notifications').set('Cookie', await ctx.as('karim')).expect(200)).body;
    expect(notes.some((n: { type: string }) => n.type === 'STUDY_INVITE')).toBe(true);
  });

  it('cannot study with a non-classmate or alone', async () => {
    const lea = await ctx.as('lea');
    await ctx.http().post('/study-sessions').set('Cookie', lea).send({ partnerId: await userId('lea') }).expect(400);
    await ctx.http().post('/study-sessions').set('Cookie', lea).send({ partnerId: await userId('rana') }).expect(403);
    await ctx.http().post('/study-sessions').set('Cookie', await ctx.as('rana')).send({ partnerId: await userId('lea') }).expect(403);
  });

  it('only participants see or join the session', async () => {
    await ctx.http().get(`/study-sessions/${sessionId}`).set('Cookie', await ctx.as('omar')).expect(403);
    await ctx.http().get(`/study-sessions/${sessionId}`).set('Cookie', await ctx.as('mona')).expect(403);
    await ctx.http().get(`/study-sessions/${sessionId}`).set('Cookie', await ctx.as('rana')).expect(200);
    const omar = await connect(await ctx.as('omar'));
    expect(await emit(omar, 'room:join', { room: `study:${sessionId}` })).toEqual({ ok: false, error: 'forbidden' });
  });

  it('accept → both in the room; a disconnect does NOT end the session; End does', async () => {
    const karimCookie = await ctx.as('karim');
    const accepted = await ctx.http().post(`/study-sessions/${sessionId}/accept`).set('Cookie', karimCookie).expect(201);
    expect(accepted.body.status).toBe('ACTIVE');

    const lea = await connect(await ctx.as('lea'));
    const karim = await connect(karimCookie);
    const a = await emit<{ ok: boolean; publishes: boolean; snapshot: { map: string } }>(lea, 'room:join', { room: `study:${sessionId}` });
    expect(a).toMatchObject({ ok: true, publishes: true, snapshot: { map: 'study' } });
    const ended: unknown[] = [];
    lea.on('study:ended', (d) => ended.push(d));
    const emotes: unknown[] = [];
    lea.on('player:emote', (d) => emotes.push(d));
    await emit(karim, 'room:join', { room: `study:${sessionId}` });
    karim.emit('emote', { room: `study:${sessionId}`, emote: 'dance' });
    await wait(100);
    expect(emotes).toHaveLength(1);

    // Karim's connection drops: the session must keep running for Lea.
    karim.disconnect();
    await wait(400);
    expect(ended).toHaveLength(0);
    expect((await ctx.http().get(`/study-sessions/${sessionId}`).set('Cookie', await ctx.as('lea')).expect(200)).body.status).toBe('ACTIVE');
    // The sweeper also leaves it alone while someone is in the room.
    await ctx.app.get(StudySessionsService).sweep(new Date(Date.now() + 10 * 60_000));
    expect((await ctx.prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } })).status).toBe('ACTIVE');

    // Long enough for XP, then Lea ends it.
    await ctx.prisma.studySession.update({ where: { id: sessionId }, data: { startedAt: new Date(Date.now() - STUDY_MIN_XP_MS - 1000) } });
    const xpBefore = await ctx.prisma.xpEvent.count({ where: { reason: 'STUDY_SESSION' } });
    const r = await ctx.http().post(`/study-sessions/${sessionId}/end`).set('Cookie', await ctx.as('lea')).expect(201);
    expect(r.body.status).toBe('ENDED');
    await wait(100);
    expect(ended).toHaveLength(1);
    expect(await ctx.prisma.xpEvent.count({ where: { reason: 'STUDY_SESSION' } })).toBe(xpBefore + 2);
    // events were recorded
    const types = r.body.events.map((e: { type: string }) => e.type);
    expect(types).toEqual(expect.arrayContaining(['INVITED', 'ACCEPTED', 'JOIN', 'EMOTE', 'ENDED']));
    // idempotent
    await ctx.http().post(`/study-sessions/${sessionId}/end`).set('Cookie', await ctx.as('lea')).expect(201);
    expect(await ctx.prisma.xpEvent.count({ where: { reason: 'STUDY_SESSION' } })).toBe(xpBefore + 2);
  });

  it('a session nobody is in gets swept after a while', async () => {
    const r = await ctx.http().post('/study-sessions').set('Cookie', await ctx.as('omar')).send({ partnerId: await userId('karim') }).expect(201);
    await ctx.http().post(`/study-sessions/${r.body.id}/accept`).set('Cookie', await ctx.as('karim')).expect(201);
    await ctx.app.get(StudySessionsService).sweep(new Date(Date.now() + 10 * 60_000));
    const s = await ctx.prisma.studySession.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(s).toMatchObject({ status: 'ENDED', endedReason: 'ABANDONED' });
  });

  it('records chunks per participant; partner and teacher can listen, others cannot', async () => {
    const r = await ctx.http().post('/study-sessions').set('Cookie', await ctx.as('lea')).send({ partnerId: await userId('karim') }).expect(201);
    const sid = r.body.id;
    await ctx.http().post(`/study-sessions/${sid}/accept`).set('Cookie', await ctx.as('karim')).expect(201);
    const lea = await ctx.as('lea');
    // study sessions are recorded only when enabled
    config.RECORD_STUDY_SESSIONS = false;
    await ctx.http().post('/recordings').set('Cookie', lea).send({ kind: 'STUDY', refId: sid, mime: 'audio/webm' }).expect(409);
    config.RECORD_STUDY_SESSIONS = true;
    const rec = (await ctx.http().post('/recordings').set('Cookie', lea).send({ kind: 'STUDY', refId: sid, mime: 'audio/webm;codecs=opus' }).expect(201)).body;
    await ctx.http().post(`/recordings/${rec.id}/chunks?seq=0`).set('Cookie', lea).attach('chunk', Buffer.from('AAAA'), { filename: 'c0.webm', contentType: 'audio/webm' }).expect(201);
    await ctx.http().post(`/recordings/${rec.id}/chunks?seq=1`).set('Cookie', lea).attach('chunk', Buffer.from('BBB'), { filename: 'c1.webm', contentType: 'audio/webm' }).expect(201);
    // retried chunk is a no-op
    await ctx.http().post(`/recordings/${rec.id}/chunks?seq=1`).set('Cookie', lea).attach('chunk', Buffer.from('BBB'), { filename: 'c1.webm', contentType: 'audio/webm' }).expect(201);
    // Karim cannot write into Lea's recording
    await ctx.http().post(`/recordings/${rec.id}/chunks?seq=2`).set('Cookie', await ctx.as('karim')).attach('chunk', Buffer.from('X'), { filename: 'c.webm', contentType: 'audio/webm' }).expect(403);
    await ctx.http().post(`/recordings/${rec.id}/stop`).set('Cookie', lea).expect(201);
    const audio = await ctx.http().get(`/recordings/${rec.id}/audio`).set('Cookie', await ctx.as('karim')).expect(200);
    expect(Buffer.from(audio.body).toString()).toBe('AAAABBB');
    const list = (await ctx.http().get(`/recordings?kind=STUDY&refId=${sid}`).set('Cookie', await ctx.as('rana')).expect(200)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ bytes: 7, chunks: 2 });
    await ctx.http().get(`/recordings/${rec.id}/audio`).set('Cookie', await ctx.as('omar')).expect(403);
    await ctx.http().get(`/recordings/${rec.id}/audio`).set('Cookie', await ctx.as('mona')).expect(403);

    // Range requests (Safari playback, seeking): 206 with the exact bytes across chunk boundaries
    const part = await ctx.http().get(`/recordings/${rec.id}/audio`).set('Cookie', lea).set('Range', 'bytes=2-5').expect(206);
    expect(part.headers['content-range']).toBe('bytes 2-5/7');
    expect(part.headers['accept-ranges']).toBe('bytes');
    expect(part.headers['content-length']).toBe('4');
    expect(Buffer.from(part.body).toString()).toBe('AABB');
    const tail = await ctx.http().get(`/recordings/${rec.id}/audio`).set('Cookie', lea).set('Range', 'bytes=-2').expect(206);
    expect(Buffer.from(tail.body).toString()).toBe('BB');
    await ctx.http().get(`/recordings/${rec.id}/audio`).set('Cookie', lea).set('Range', 'bytes=9-').expect(416);

    // per-recording cap and per-school budget → friendly 413
    const rec2 = (await ctx.http().post('/recordings').set('Cookie', lea).send({ kind: 'STUDY', refId: sid, mime: 'audio/webm' }).expect(201)).body;
    await ctx.prisma.recording.update({ where: { id: rec2.id }, data: { bytes: MAX_RECORDING_BYTES - 1 } });
    const full = await ctx.http().post(`/recordings/${rec2.id}/chunks?seq=0`).set('Cookie', lea).attach('chunk', Buffer.from('CC'), { filename: 'c.webm', contentType: 'audio/webm' }).expect(413);
    expect(full.body.code).toBe('RECORDING_FULL');
    await ctx.prisma.recording.update({ where: { id: rec2.id }, data: { bytes: 0 } });
    const budget = config.RECORDINGS_MAX_MB_PER_SCHOOL;
    config.RECORDINGS_MAX_MB_PER_SCHOOL = 8 / (1024 * 1024); // 8 bytes; the school already has 7
    try {
      const over = await ctx.http().post(`/recordings/${rec2.id}/chunks?seq=0`).set('Cookie', lea).attach('chunk', Buffer.from('CC'), { filename: 'c.webm', contentType: 'audio/webm' }).expect(413);
      expect(over.body.code).toBe('SCHOOL_BUDGET_FULL');
    } finally {
      config.RECORDINGS_MAX_MB_PER_SCHOOL = budget;
    }

    // retention removes old recordings
    await ctx.prisma.recording.update({ where: { id: rec2.id }, data: { startedAt: new Date(Date.now() - (config.RECORDINGS_RETENTION_DAYS + 1) * 86_400_000) } });
    expect(await ctx.app.get(RecordingsService).purgeOld()).toBeGreaterThanOrEqual(1);
    expect(await ctx.prisma.recording.findUnique({ where: { id: rec2.id } })).toBeNull();
    config.RECORD_STUDY_SESSIONS = false;
    await ctx.http().post(`/study-sessions/${sid}/end`).set('Cookie', lea).expect(201);
  });
});

describe('AI voice-interview exams', () => {
  let examId: string;
  let leaAttempt: string;

  it('teacher creates an exam over chosen lessons; AI prepares questions sized to the time', async () => {
    const rana = await ctx.as('rana');
    const cls = await ctx.prisma.class.findFirstOrThrow({ where: { name: '8B Math' } });
    const lessons = await ctx.prisma.lesson.findMany({ where: { courseId: cls.courseId! }, orderBy: { position: 'asc' } });
    expect(lessons.length).toBeGreaterThan(1);
    // Text stored at gamify time is reused; other lessons get a text-only read (no video download / AI watching).
    await ctx.prisma.lesson.update({ where: { id: lessons[0].id }, data: { contentText: 'STORED-LESSON-TEXT-MARKER' } });
    const collect = jest.spyOn(ctx.app.get(LessonContentService), 'collect');
    const ai = ctx.app.get(AiService);
    const run = jest.spyOn(ai, 'run');
    const now = Date.now();
    const r = await ctx.http().post('/exams').set('Cookie', rana).send({
      classId: cls.id,
      lessonIds: lessons.map((l) => l.id),
      title: 'Test interview',
      durationMin: 10,
      opensAt: new Date(now - 60_000).toISOString(),
      closesAt: new Date(now + 3600_000).toISOString(),
      locale: 'en',
    }).expect(201);
    examId = r.body.id;
    await ctx.app.get(ExamPrepService).idle();
    expect(collect.mock.calls.some(([id]) => id === lessons[0].id)).toBe(false);
    expect(collect.mock.calls.length).toBe(lessons.length - 1);
    expect(collect.mock.calls.every(([, o]) => o?.textOnly === true)).toBe(true);
    const prep = run.mock.calls.find(([task]) => task.name === 'prepareExam');
    expect((prep?.[1] as { content: string }).content).toContain('STORED-LESSON-TEXT-MARKER');
    collect.mockRestore();
    run.mockRestore();
    const d = (await ctx.http().get(`/exams/${examId}`).set('Cookie', rana).expect(200)).body;
    expect(d.status).toBe('READY');
    expect(d.questions).toHaveLength(7); // 10 minutes → ~1 question / 90 s
    expect(d.lessons).toHaveLength(lessons.length);
  });

  it('other teachers and students cannot manage it; lessons must belong to the class', async () => {
    await ctx.http().get(`/exams/${examId}`).set('Cookie', await ctx.as('hassan')).expect(403);
    await ctx.http().post(`/exams/${examId}/publish`).set('Cookie', await ctx.as('lea')).expect(403);
    const cls = await ctx.prisma.class.findFirstOrThrow({ where: { name: '8B Math' } });
    await ctx.http().post('/exams').set('Cookie', await ctx.as('rana')).send({ classId: cls.id, lessonIds: ['nope'], title: 'X', durationMin: 5, opensAt: new Date().toISOString(), closesAt: new Date(Date.now() + 1e6).toISOString() }).expect(400);
  });

  it('teacher edits a question and publishes → one private room per student', async () => {
    const rana = await ctx.as('rana');
    const d = (await ctx.http().get(`/exams/${examId}`).set('Cookie', rana)).body;
    const questions = d.questions.slice(0, 3);
    questions[0] = { ...questions[0], text: 'What is the area of a triangle with base 4 and height 3? Explain.' };
    await ctx.http().patch(`/exams/${examId}`).set('Cookie', rana).send({ questions }).expect(200);
    const p = (await ctx.http().post(`/exams/${examId}/publish`).set('Cookie', rana).expect(201)).body;
    expect(p.status).toBe('OPEN');
    expect(p.attempts).toHaveLength(3);
    const mine = (await ctx.http().get('/exams/mine').set('Cookie', await ctx.as('lea')).expect(200)).body;
    const row = mine.find((m: { examId: string }) => m.examId === examId);
    expect(row).toMatchObject({ status: 'NOT_STARTED', examStatus: 'OPEN', score: null });
    leaAttempt = row.attemptId;
    // students never get the question bank from the exam endpoint
    const asLea = (await ctx.http().get(`/exams/${examId}`).set('Cookie', await ctx.as('lea')).expect(200)).body;
    expect(asLea.questions).toBeUndefined();
    expect(asLea.questionCount).toBe(3);
  });

  it('student interview: start → answers → follow-up → finish; scores hidden until release', async () => {
    const lea = await ctx.as('lea');
    await ctx.http().post(`/exam-attempts/${leaAttempt}/start`).set('Cookie', await ctx.as('karim')).expect(403);
    const s = (await ctx.http().post(`/exam-attempts/${leaAttempt}/start`).set('Cookie', lea).expect(201)).body;
    expect(s.status).toBe('IN_PROGRESS');
    expect(s.turns[0].text).toMatch(/area of a triangle/);
    expect(s.secondsLeft).toBeGreaterThan(500);

    // Teacher spectates live and receives turns.
    const teacher = await connect(await ctx.as('rana'));
    const spect = await emit<{ ok: boolean; publishes: boolean }>(teacher, 'room:join', { room: `exam:${leaAttempt}`, spectate: true });
    expect(spect).toMatchObject({ ok: true, publishes: false });
    const live: { turn: { role: string; eval?: unknown } }[] = [];
    teacher.on('exam:turn', (d) => live.push(d));
    // a teacher of another class cannot spectate
    const hassan = await connect(await ctx.as('hassan'));
    expect(await emit(hassan, 'room:join', { room: `exam:${leaAttempt}`, spectate: true })).toEqual({ ok: false, error: 'forbidden' });

    // short answer → follow-up on the same question
    let st = (await ctx.http().post(`/exam-attempts/${leaAttempt}/answer`).set('Cookie', lea).send({ text: 'It is six' }).expect(201)).body;
    expect(st.questionIdx).toBe(0);
    const ai1 = st.turns[st.turns.length - 1];
    expect(ai1).toMatchObject({ role: 'AI', mood: 'confused', emoji: '🤔' });
    expect(st.turns.some((t: { eval?: unknown }) => t.eval)).toBe(false); // no private assessments for students
    // full answer → next question
    st = (await ctx.http().post(`/exam-attempts/${leaAttempt}/answer`).set('Cookie', lea).send({ text: 'Half of the base times the height, so four times three is twelve and half of it is six square units.' }).expect(201)).body;
    expect(st.questionIdx).toBe(1);
    // "I don't know" → nervous, reassuring emoji
    st = (await ctx.http().post(`/exam-attempts/${leaAttempt}/answer`).set('Cookie', lea).send({ text: "I don't know" }).expect(201)).body;
    expect(st.turns[st.turns.length - 1]).toMatchObject({ mood: 'nervous', emoji: '💪' });
    await wait(100);
    expect(live.some((l) => l.turn.role === 'STUDENT')).toBe(true);

    st = (await ctx.http().post(`/exam-attempts/${leaAttempt}/finish`).set('Cookie', lea).expect(201)).body;
    expect(st.status).toBe('GRADING');
    await ctx.app.get(ExamRoomService).idle();
    st = (await ctx.http().get(`/exam-attempts/${leaAttempt}`).set('Cookie', lea).expect(200)).body;
    expect(st.status).toBe('GRADED');
    expect(st.result).toBeNull(); // hidden until the teacher approves
    await ctx.http().get(`/exams/child/${await userId('lea')}`).set('Cookie', await ctx.as('mona')).expect(200).expect([]);

    const asTeacher = (await ctx.http().get(`/exam-attempts/${leaAttempt}`).set('Cookie', await ctx.as('rana')).expect(200)).body;
    expect(asTeacher.result.aiScore).toEqual(expect.any(Number));
    expect(asTeacher.turns.some((t: { eval?: unknown }) => t.eval)).toBe(true);
  });

  it('teacher overrides, releases → student and parent see the result, XP awarded', async () => {
    const r = (await ctx.http().post(`/exam-attempts/${leaAttempt}/review`).set('Cookie', await ctx.as('rana')).send({ score: 75, comment: 'Nice reasoning!', release: true }).expect(201)).body;
    expect(r.status).toBe('RELEASED');
    const st = (await ctx.http().get(`/exam-attempts/${leaAttempt}`).set('Cookie', await ctx.as('lea')).expect(200)).body;
    expect(st.result).toMatchObject({ score: 75, teacherComment: 'Nice reasoning!' });
    const child = (await ctx.http().get(`/exams/child/${await userId('lea')}`).set('Cookie', await ctx.as('mona')).expect(200)).body;
    expect(child[0]).toMatchObject({ score: 75 });
    expect(await ctx.prisma.xpEvent.count({ where: { reason: 'EXAM_DONE', refId: leaAttempt } })).toBe(1);
    await ctx.http().post(`/exam-attempts/${leaAttempt}/review`).set('Cookie', await ctx.as('hassan')).send({ score: 10 }).expect(403);
  });

  it('the cron closes the window: missed rooms and running interviews are finished', async () => {
    const svc = ctx.app.get(ExamsService);
    const karimAttempt = await ctx.prisma.examAttempt.findFirstOrThrow({ where: { examId, student: { devHandle: 'karim' } } });
    await ctx.http().post(`/exam-attempts/${karimAttempt.id}/start`).set('Cookie', await ctx.as('karim')).expect(201);
    const r = await svc.tick(new Date(Date.now() + 2 * 3600_000));
    expect(r.closed).toBeGreaterThanOrEqual(1);
    await ctx.app.get(ExamRoomService).idle();
    const atts = await ctx.prisma.examAttempt.findMany({ where: { examId }, include: { student: true } });
    expect(atts.find((a) => a.student.devHandle === 'omar')?.status).toBe('MISSED');
    expect(atts.find((a) => a.student.devHandle === 'karim')?.status).toBe('GRADED');
    expect((await ctx.prisma.exam.findUniqueOrThrow({ where: { id: examId } })).status).toBe('CLOSED');
  });

  it('an AI failure mid-interview still moves on to the next question (unscored turn)', async () => {
    const att = await ctx.prisma.examAttempt.findFirstOrThrow({ where: { exam: { title: 'Geometry voice check-in' }, student: { devHandle: 'karim' } } });
    const karim = await ctx.as('karim');
    await ctx.http().post(`/exam-attempts/${att.id}/start`).set('Cookie', karim).expect(201);
    const ai = ctx.app.get(AiService);
    const orig = ai.run.bind(ai);
    const run = jest.spyOn(ai, 'run').mockImplementation(async (task, input, opts) => {
      if (task.name === 'interviewTurn') throw new Error('AI down');
      return orig(task, input, opts);
    });
    try {
      const st = (await ctx.http().post(`/exam-attempts/${att.id}/answer`).set('Cookie', karim).send({ text: 'A long enough answer about the area of triangles and why it works.' }).expect(201)).body;
      expect(st.status).toBe('IN_PROGRESS');
      expect(st.questionIdx).toBe(1);
      expect(st.turns[st.turns.length - 1]).toMatchObject({ role: 'AI', questionId: 'q2' });
      expect(st.turns[st.turns.length - 1].text).toMatch(/keep going/);
    } finally {
      run.mockRestore();
    }
    const turn = await ctx.prisma.examTurn.findFirstOrThrow({ where: { attemptId: att.id, role: 'STUDENT' } });
    expect(turn.eval).toBeNull();
    await ctx.http().post(`/exam-attempts/${att.id}/finish`).set('Cookie', karim).expect(201);
    await ctx.app.get(ExamRoomService).idle();
  });

  it('time limit: an answer after endsAt finishes the interview', async () => {
    const att = await ctx.prisma.examAttempt.findFirstOrThrow({ where: { exam: { title: 'Geometry voice check-in' }, student: { devHandle: 'lea' } } });
    const lea = await ctx.as('lea');
    await ctx.http().post(`/exam-attempts/${att.id}/start`).set('Cookie', lea).expect(201);
    await ctx.prisma.examAttempt.update({ where: { id: att.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const st = (await ctx.http().post(`/exam-attempts/${att.id}/answer`).set('Cookie', lea).send({ text: 'late answer' }).expect(201)).body;
    expect(st.status).toBe('GRADING');
    expect(st.finishReason).toBe('TIME_UP');
    await ctx.app.get(ExamRoomService).idle();
  });
});
