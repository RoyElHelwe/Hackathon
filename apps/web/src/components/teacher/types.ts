import type { I18nText, MasteryState, SubmissionStatus } from '@tajriba/shared';
import type { Mission } from '@/lib/types';

export type StuckReason = 'RETRIES' | 'HINTS' | 'IDLE';

export interface DashTopic {
  id: string;
  key: string;
  name: I18nText;
  icon: string;
  /** set for lesson skills (null = legacy topic) */
  courseId: string | null;
  subjectKey: string;
  subjectName: I18nText;
  color: string;
  subjectIcon: string;
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
    subjectId: string | null;
    gradeLevel: number | null;
    sectionLabel: string | null;
    course: { id: string; gradeLevel: number; subject: { id: string; name: I18nText; color: string } } | null;
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
  suggestion: CourseSuggestion;
}

export interface CourseSuggestion {
  subjectId: string | null;
  gradeLevel: number | null;
  sectionLabel: string | null;
  /** existing course with the same subject + grade */
  courseId: string | null;
}

export interface SchoolSubjectOption {
  id: string;
  key: string;
  name: I18nText;
  color: string;
  icon: string;
}

export interface CoursesResponse {
  connected: boolean;
  reconnect?: boolean;
  courses: ClassroomCourse[];
  subjects: SchoolSubjectOption[];
  schoolCourses: { id: string; subjectId: string; gradeLevel: number }[];
}

export interface ImportResult {
  classId: string;
  courseId?: string | null;
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

export interface CourseSection {
  id: string;
  name: string;
  sectionLabel: string | null;
  studentCount: number;
  syncError: string | null;
  lastSyncedAt: string | null;
  classroomLinked: boolean;
}

/** A course = one grade + subject; sections are the Classroom classes that share its lessons. */
export interface CourseSummary {
  id: string;
  gradeLevel: number;
  subject: SchoolSubjectOption;
  sectionCount: number;
  sections: CourseSection[];
  lessonCount: number;
  gamifiedCount: number;
  canEdit: boolean;
}

export interface LessonMaterial {
  type: 'drive' | 'youtube' | 'link' | 'form';
  id?: string;
  title: string;
  url: string;
  mimeType?: string | null;
  thumbnailUrl?: string | null;
}

export type LessonStatus = 'NOT_GAMIFIED' | 'GAMIFYING' | 'READY' | 'FAILED';

export type ContentCode = 'private' | 'too_large' | 'audio_only' | 'first_2h' | 'media_limit' | 'unreadable' | 'unsupported' | 'media_failed' | 'ai_failed' | 'reconnect';

/** What the AI could read of one attachment on the last gamify run ('full' = watched/listened to the whole media). */
export interface ContentReportItem {
  title: string;
  type: 'youtube' | 'video' | 'audio' | 'document' | 'file' | 'link' | 'form';
  status: 'full' | 'text' | 'title' | 'failed';
  /** English fallback; `codes` are localized */
  note?: string;
  codes?: ContentCode[];
}

export interface CourseLesson {
  id: string;
  title: string;
  description: string;
  kind: 'MATERIAL' | 'ASSIGNMENT';
  materials: LessonMaterial[];
  position: number;
  postedAt: string;
  status: LessonStatus;
  /** error code when status is FAILED (AI_UNAVAILABLE | INTERRUPTED | FAILED) */
  gamifyError: string | null;
  /** null before the first gamify run */
  contentReport: ContentReportItem[] | null;
  contentChangedAt: string | null;
  sources: { classId: string; classroomUrl: string | null }[];
  /** the skill created by "Gamify with AI" */
  topic: { id: string; name: I18nText } | null;
  /** course mission templates of this lesson's skill */
  draftCount: number;
  approvedCount: number;
}

export interface LessonSyncResult {
  lessons: number;
  added: number;
  archived: number;
  reconnect: boolean;
  failedSections: number;
}
