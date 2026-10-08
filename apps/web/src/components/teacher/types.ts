import type { I18nText, MasteryState, SubmissionStatus } from '@tajriba/shared';
import type { Mission } from '@/lib/types';

export type StuckReason = 'RETRIES' | 'HINTS' | 'IDLE';

export interface DashTopic {
  id: string;
  key: string;
  name: I18nText;
  subjectKey: string;
  color: string;
}

export interface DashStudent {
  id: string;
  name: string;
  avatarUrl: string | null;
  stuck: boolean;
}

export interface DashCell {
  studentId: string;
  topicId: string;
  state: MasteryState;
  bestScore: number;
}

export interface StuckAlert {
  studentId: string;
  studentName: string;
  topicId: string;
  topicKey: string;
  topicName: I18nText;
  reasons: StuckReason[];
}

export interface ActivityItem {
  submissionId: string;
  studentName: string;
  avatarUrl?: string | null;
  missionTitle: I18nText;
  status: SubmissionStatus;
  at: string;
}

export interface TeacherDashboard {
  class: {
    id: string;
    name: string;
    syncError: string | null;
    lastSyncedAt: string | null;
    settings: { leaderboardEnabled?: boolean };
    classroomCourseId: string | null;
  };
  topics: DashTopic[];
  students: DashStudent[];
  cells: DashCell[];
  stuck: StuckAlert[];
  recent: ActivityItem[];
  stats: { students: number; avgMastery: number; validatedThisWeek: number; pendingReviews: number; stuckCount: number };
}

export interface ClassStudent {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: 'INVITED' | 'ACTIVE' | string;
  enrollment: string;
  xp: number;
  level: number;
  mastered: number;
  parents: { id: string; name: string; email: string }[];
}

export interface ClassroomCourse {
  id: string;
  name: string;
  section: string | null;
  gradeLevel?: number | null;
  studentCount: number;
  imported: boolean;
  classId: string | null;
}

export interface CoursesResponse {
  connected: boolean;
  reconnect?: boolean;
  courses: ClassroomCourse[];
}

export interface ImportResult {
  classId: string;
  name: string;
  added: number;
  archived: number;
  total: number;
}

export interface SyncResult {
  added: number;
  archived: number;
  total: number;
  reconnect?: boolean;
}

export interface GroupSession {
  topic: string;
  plan: string[];
  students: { id: string; name: string }[];
}

export interface Leaderboard {
  top: { studentId: string; name: string; avatarUrl: string | null; xp: number; rank: number; level: number }[];
  me: { rank: number; xp: number; level: number } | null;
  total: number;
}

export interface Subject {
  id: string;
  key: string;
  name: I18nText;
  color: string;
  icon: string;
  topicCount: number;
}

export interface StudentHistoryItem {
  id: string;
  status: SubmissionStatus;
  attempt: number;
  startedAt: string;
  submittedAt: string | null;
  validatedAt: string | null;
  finalScore: number | null;
  aiScore: number | null;
  photoUploadIds: string[];
  gradeSynced: boolean;
  evaluatorFirstName: string | null;
  mission: { id: string; title: I18nText; audience: string; topicKey: string; topicName: I18nText; subjectKey: string };
}

export interface ApproveResult {
  mission: Mission;
  classroom: { posted: boolean; error?: string } | null;
}

export type SafetyResult = NonNullable<Mission['safetyCheck']>;
