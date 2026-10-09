import { z } from 'zod';
import { DIFFICULTIES, LOCALES } from './enums';

// ---------- AI voice-interview exams ----------

export const EXAM_MOODS = ['calm', 'nervous', 'confident', 'confused', 'happy', 'thinking'] as const;
export type ExamMood = (typeof EXAM_MOODS)[number];

/** Fallback emoji per detected student feeling (the AI usually picks its own). */
export const MOOD_EMOJI: Record<ExamMood, string> = {
  calm: '🙂',
  nervous: '💪',
  confident: '🎉',
  confused: '🤔',
  happy: '😄',
  thinking: '💭',
};

/** About one question per 90 seconds of interview, 3–12 questions. */
export function questionCountFor(durationMin: number): number {
  return Math.min(12, Math.max(3, Math.round((durationMin * 60) / 90)));
}

/** At most this many follow-up questions per main question. */
export const MAX_FOLLOW_UPS = 1;
/** With less time than this left, the interviewer wraps up instead of asking a new question. */
export const WRAP_UP_SECONDS = 25;

export const EXAM_DURATION = { min: 3, max: 30, default: 10 } as const;

/** The attempt ends at start + duration, but never after the exam window closes. */
export function attemptEndsAt(startedAt: Date, durationMin: number, closesAt: Date): Date {
  return new Date(Math.min(startedAt.getTime() + durationMin * 60_000, closesAt.getTime()));
}

export type ExamPhase = 'DRAFT' | 'PREPARING' | 'READY' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'FAILED';

/** Status the exam should have right now (the cron flips stored statuses; this keeps reads correct between ticks). */
export function effectiveExamStatus(exam: { status: ExamPhase; opensAt: Date; closesAt: Date }, now: Date = new Date()): ExamPhase {
  if (exam.status === 'SCHEDULED' || exam.status === 'OPEN') {
    if (now >= exam.closesAt) return 'CLOSED';
    if (now >= exam.opensAt) return 'OPEN';
    return 'SCHEDULED';
  }
  return exam.status;
}

/** Final score shown to the student: the teacher's override wins over the AI score. */
export function finalExamScore(a: { aiScore: number | null; teacherScore: number | null }): number | null {
  return a.teacherScore ?? a.aiScore;
}

// ---------- Schemas ----------

export const examQuestion = z.object({
  id: z.string().min(1).max(20),
  text: z.string().min(5).max(500),
  expectedPoints: z.array(z.string().min(1).max(300)).min(1).max(5),
  difficulty: z.enum(DIFFICULTIES),
  followUp: z.string().max(400).optional(),
});
export type ExamQuestion = z.infer<typeof examQuestion>;

export const prepareExamOutput = z.object({ questions: z.array(examQuestion).min(1).max(15) });
export type PrepareExamOutput = z.infer<typeof prepareExamOutput>;

export const interviewTurnOutput = z.object({
  assessment: z.object({
    score: z.number().min(0).max(10),
    understood: z.boolean(),
    notes: z.string().max(400),
  }),
  mood: z.enum(EXAM_MOODS),
  emoji: z.string().min(1).max(16),
  reaction: z.string().min(1).max(300),
  next: z.enum(['FOLLOW_UP', 'NEXT_QUESTION', 'FINISH']),
  followUpQuestion: z.string().max(400).optional(),
});
export type InterviewTurnOutput = z.infer<typeof interviewTurnOutput>;

export const examReportOutput = z.object({
  score: z.number().int().min(0).max(100),
  perQuestion: z.array(z.object({ questionId: z.string(), score: z.number().min(0).max(10), comment: z.string().max(400) })).max(15),
  strengths: z.array(z.string().max(200)).max(5),
  gaps: z.array(z.string().max(200)).max(5),
  teacherNotes: z.string().max(800),
  studentFeedback: z.string().max(600),
});
export type ExamReport = z.infer<typeof examReportOutput>;

export const discussionCardsOutput = z.object({
  cards: z
    .array(z.object({ kind: z.enum(['QUESTION', 'CHALLENGE', 'FUN']), prompt: z.string().min(3).max(300) }))
    .min(3)
    .max(8),
});
export type DiscussionCards = z.infer<typeof discussionCardsOutput>;

const isoDate = z.coerce.date();

export const createExamBody = z
  .object({
    classId: z.string().min(1),
    lessonIds: z.array(z.string().min(1)).min(1).max(10),
    title: z.string().trim().min(2).max(120),
    durationMin: z.number().int().min(EXAM_DURATION.min).max(EXAM_DURATION.max),
    opensAt: isoDate,
    closesAt: isoDate,
    locale: z.enum(LOCALES).default('en'),
  })
  .refine((b) => b.closesAt.getTime() > b.opensAt.getTime(), { message: 'The exam must close after it opens.', path: ['closesAt'] });
export type CreateExamBody = z.infer<typeof createExamBody>;

export const updateExamBody = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  durationMin: z.number().int().min(EXAM_DURATION.min).max(EXAM_DURATION.max).optional(),
  opensAt: isoDate.optional(),
  closesAt: isoDate.optional(),
  questions: z.array(examQuestion).min(1).max(15).optional(),
});
export type UpdateExamBody = z.infer<typeof updateExamBody>;

export const examAnswerBody = z.object({ text: z.string().trim().min(1).max(3000) });
export const examReviewBody = z.object({
  score: z.number().int().min(0).max(100).optional(),
  comment: z.string().max(1000).optional(),
  release: z.boolean().default(true),
});

export const createStudySessionBody = z.object({
  partnerId: z.string().min(1),
  classId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
});
export const startRecordingBody = z.object({
  kind: z.enum(['STUDY', 'EXAM']),
  refId: z.string().min(1),
  mime: z.string().regex(/^audio\/(webm|ogg|mp4)(;.*)?$/),
});
