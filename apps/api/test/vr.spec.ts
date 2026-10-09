import { ExamPrepService } from '../src/exams/exam-prep.service';
import { ExamRoomService } from '../src/exams/exam-room.service';
import { ExamTranscribeService, MAX_ANSWER_AUDIO_BYTES } from '../src/exams/exam-transcribe.service';
import { createTestApp, TestCtx } from './app';

/** VR exam: spoken answers recorded in the headset are turned into text (mock AI here). */
let ctx: TestCtx;
let attemptId: string;

beforeAll(async () => {
  ctx = await createTestApp();
  ctx.app.get(ExamTranscribeService).gapMs = 0;
  const lea = await ctx.prisma.user.findUniqueOrThrow({ where: { devHandle: 'lea' } });
  const att = await ctx.prisma.examAttempt.findFirstOrThrow({ where: { studentId: lea.id, exam: { title: 'Geometry voice check-in' } } });
  attemptId = att.id;
});
afterAll(async () => {
  await ctx.app.get(ExamPrepService).idle();
  await ctx.app.get(ExamRoomService).idle();
  await ctx.app.close();
});

const clip = Buffer.from('OggS fake opus answer');
const send = async (handle: string, body = clip, mime = 'audio/webm') =>
  ctx
    .http()
    .post(`/exam-attempts/${attemptId}/transcribe`)
    .set('Cookie', await ctx.as(handle))
    .attach('audio', body, { filename: 'answer.webm', contentType: mime });

describe('POST /exam-attempts/:id/transcribe', () => {
  it('only while the interview runs', async () => {
    expect((await send('lea')).status).toBe(409);
  });

  it('turns the student’s spoken answer into text', async () => {
    await ctx.http().post(`/exam-attempts/${attemptId}/start`).set('Cookie', await ctx.as('lea')).expect(201);
    const r = await send('lea');
    expect(r.status).toBe(201);
    expect(r.body.text).toMatch(/similar triangles/i);
    // nothing was graded or stored: the transcript is just shown back for the student to send
    const turns = await ctx.prisma.examTurn.count({ where: { attemptId, role: 'STUDENT' } });
    expect(turns).toBe(0);
  });

  it('is only for the student who owns the attempt', async () => {
    expect((await send('karim')).status).toBe(403);
    expect((await send('rana')).status).toBe(403);
  });

  it('rejects non-audio files and oversized clips', async () => {
    expect((await send('lea', clip, 'image/png')).status).toBe(400);
    expect((await send('lea', Buffer.alloc(MAX_ANSWER_AUDIO_BYTES + 1, 1))).status).toBe(413);
  });

  it('one answer at a time', async () => {
    const svc = ctx.app.get(ExamTranscribeService);
    svc.gapMs = 60_000;
    svc.resetThrottle();
    expect((await send('lea')).status).toBe(201);
    expect((await send('lea')).status).toBe(429);
    svc.gapMs = 0;
  });
});
