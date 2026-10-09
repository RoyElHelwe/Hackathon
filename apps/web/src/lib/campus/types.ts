import type { ExamQuestion, ExamReport, PlayerState } from '@tajriba/shared';

export type { PlayerState };

export interface Classmate {
  userId: string;
  name: string;
  avatarUrl: string | null;
  classId: string;
  className: string;
  online: boolean;
}

/** A study session running right now in one of my classes (the Study Hall tables light up). */
export interface LiveStudySession {
  id: string;
  names: string[];
}

export type StudyStatus = 'INVITED' | 'ACTIVE' | 'ENDED' | 'DECLINED' | 'EXPIRED';

export interface StudySessionListItem {
  id: string;
  status: StudyStatus;
  isHost: boolean;
  partner: { userId: string; name: string; avatarUrl: string | null } | null;
  className: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface SessionEventItem {
  id: string;
  userId: string | null;
  type: string;
  payload: Record<string, unknown>;
  at: string;
}

export interface StudySessionDetail {
  id: string;
  status: StudyStatus;
  hostId: string;
  classId: string;
  className: string;
  topicId: string | null;
  topic: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
  /** time both partners were in the room at once (stored total, without the running segment) */
  togetherMs: number;
  /** start of the running together-segment, null when apart */
  togetherSince: string | null;
  room: string;
  participants: { userId: string; name: string; avatarUrl: string | null; joinedAt: string | null; leftAt: string | null; online: boolean }[];
  events: SessionEventItem[];
}

export interface TeacherStudySession {
  id: string;
  status: StudyStatus;
  participants: { userId: string; name: string }[];
  startedAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
  durationSec: number;
  recordings: number;
}

export interface RecordingItem {
  id: string;
  userId: string;
  name: string;
  mime: string;
  bytes: number;
  chunks: number;
  startedAt: string;
  endedAt: string | null;
}

export interface DiscussionCard {
  kind: 'QUESTION' | 'CHALLENGE' | 'FUN';
  prompt: string;
}

export type ExamStatus = 'DRAFT' | 'PREPARING' | 'READY' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'FAILED';
export type AttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'GRADING' | 'GRADED' | 'RELEASED' | 'MISSED';

export interface ExamCounts {
  NOT_STARTED: number;
  IN_PROGRESS: number;
  GRADING: number;
  GRADED: number;
  RELEASED: number;
  MISSED: number;
  total: number;
}

export interface ExamListItem {
  id: string;
  title: string;
  classId: string;
  className: string;
  status: ExamStatus;
  prepError: string | null;
  durationMin: number;
  opensAt: string;
  closesAt: string;
  counts: ExamCounts;
}

export interface ExamAttemptRow {
  id: string;
  roomIndex: number;
  student: { id: string; name: string; avatarUrl: string | null };
  status: AttemptStatus;
  questionIdx: number;
  startedAt: string | null;
  endsAt: string | null;
  finishedAt: string | null;
  aiScore: number | null;
  teacherScore: number | null;
  score: number | null;
  lastEmoji: string | null;
  lastMood: string | null;
  online: boolean;
  spectators: number;
}

export interface ExamDetail {
  id: string;
  title: string;
  classId: string;
  className: string;
  locale: string;
  durationMin: number;
  opensAt: string;
  closesAt: string;
  status: ExamStatus;
  lessons: { id: string; title: string }[];
  // teacher only
  prepError?: string | null;
  questions?: ExamQuestion[];
  resultsReleasedAt?: string | null;
  canEdit?: boolean;
  counts?: ExamCounts;
  attempts?: ExamAttemptRow[];
  // student only
  questionCount?: number;
  attempt?: { id: string; status: AttemptStatus } | null;
}

export interface MyExam {
  attemptId: string;
  examId: string;
  title: string;
  className: string;
  durationMin: number;
  opensAt: string;
  closesAt: string;
  examStatus: ExamStatus;
  status: AttemptStatus;
  roomIndex: number;
  score: number | null;
}

export interface ExamTurn {
  idx: number;
  role: 'AI' | 'STUDENT';
  text: string;
  emoji: string | null;
  mood: string | null;
  questionId: string | null;
  at: string;
  eval?: { score: number; understood: boolean; notes: string };
}

export interface AttemptView {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  status: AttemptStatus;
  room: string;
  exam: { id: string; title: string; locale: string; durationMin: number; opensAt: string; closesAt: string; status: ExamStatus };
  questionIdx: number;
  questionCount: number;
  startedAt: string | null;
  endsAt: string | null;
  secondsLeft: number | null;
  finishedAt: string | null;
  finishReason: string | null;
  thinking: boolean;
  turns: ExamTurn[];
  result: {
    score: number | null;
    aiScore: number | null;
    teacherScore: number | null;
    teacherComment: string | null;
    feedback: string | null;
    strengths: string[];
    gaps: string[];
    report?: (ExamReport & { fallback?: boolean }) | null;
    approvedAt?: string | null;
  } | null;
  questions?: ExamQuestion[];
  spectators?: number;
  online?: boolean;
}

export interface ChildExam {
  attemptId: string;
  title: string;
  finishedAt: string | null;
  score: number | null;
  teacherComment: string | null;
  feedback: string | null;
}
