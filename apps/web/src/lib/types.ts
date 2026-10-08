import type { I18nText, MasteryState, Role, SubmissionStatus, VisualSpec } from '@tajriba/shared';

export type Localized<T> = T | { en: T; ar?: T; fr?: T };

export interface Me {
  user: { id: string; name: string; email: string; avatarUrl: string | null; locale: string; status: string };
  memberships: { id: string; role: Role; status: string; school: { id: string; name: string; city: string; schoolCode: string } }[];
  active: { id: string; role: Role; schoolId: string; schoolName: string } | null;
  classroomConnected: boolean;
  children: { id: string; name: string; avatarUrl: string | null }[];
  home: string;
}

export interface ProofField {
  key: string;
  label: Localized<string>;
  unit?: string;
}

export interface Mission {
  id: string;
  key: string | null;
  topicId: string;
  classId: string | null;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  audience: 'STUDENT' | 'FAMILY' | 'SQUAD';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  title: I18nText;
  story: I18nText;
  steps: Localized<string[]>;
  miniLesson: { text: Localized<string>; visualSpec: VisualSpec };
  proofSpec: { photos: number; photoHint?: Localized<string>; explanation: boolean; fields: ProofField[] };
  rubric: { criterion: string; description: string; weight: number }[];
  safetyNotes: Localized<string>;
  safetyCheck: { safe: boolean; issues: string[]; saferVersion?: string } | null;
  xpReward: number;
  estimatedMin: number;
  dueAt: string | null;
  classroomCourseWorkId: string | null;
  aiGenerated: boolean;
  topic?: { key: string; name: I18nText; subject?: { key: string; name: I18nText; color: string; icon: string } };
  mySubmission: { id: string; status: SubmissionStatus; attempt: number } | null;
  submissionCount?: number;
}

export interface Rewards {
  xpGained: number;
  xpEvents: { reason: string; amount: number }[];
  levelBefore: number;
  levelAfter: number;
  newBadges: { key: string; name: I18nText; icon: string }[];
  unlockedTopics: { id: string; key: string; name: I18nText }[];
  streak: number;
  notificationId?: string;
  seen?: boolean;
}

export interface AiCheck {
  score: number;
  correct: boolean;
  perCriterion: { criterion: string; score: number; comment: string }[];
  feedback: string;
  followUpQuestion: string;
  flags: string[];
}

export interface Submission {
  id: string;
  status: SubmissionStatus;
  attempt: number;
  student?: { id: string; name: string; avatarUrl: string | null };
  mission: Mission;
  photoUploadIds: string[];
  audioUploadId: string | null;
  explanation: string | null;
  answers: Record<string, string | number> | null;
  aiCheck: AiCheck | null;
  followUpAnswer: string | null;
  aiFollowUpCheck: { understood: boolean; scoreDelta: number; feedback: string } | null;
  effectiveAiScore: number | null;
  finalScore: number | null;
  hintsUsed: number;
  hints: { level: number; text: string }[];
  gradeSynced: boolean;
  startedAt: string;
  submittedAt: string | null;
  validatedAt: string | null;
  peer: {
    id: string;
    status: string;
    evaluatorFirstName: string;
    evaluatorAvatarUrl: string | null;
    score: number | null;
    comment: string | null;
    checklist: { criterion: string; ok: boolean }[] | null;
    helpfulRating: number | null;
    fairnessFlag?: boolean;
  } | null;
  teacherReview: { score: number; comment: string | null; overrode: boolean } | null;
  familyConfirmation: { note: string | null; confirmedAt: string } | null;
  rewards: Rewards | null;
  flags?: string[];
  gradeSyncPending?: boolean;
}

export interface GraphNode {
  id: string;
  key: string;
  name: I18nText;
  description: I18nText;
  icon: string;
  gradeLevel: number;
  position: { x: number; y: number };
  state: MasteryState;
  bestScore: number;
  missions: { id: string; title: I18nText; difficulty: string; xpReward: number; estimatedMin: number; submissionStatus: SubmissionStatus | null; submissionId: string | null }[];
}

export interface Graph {
  subject: { id: string; key: string; name: I18nText; color: string; icon: string };
  studentId: string;
  nodes: GraphNode[];
  edges: { id: string; source: string; target: string }[];
}

export interface Gamification {
  xp: number;
  level: { level: number; xp: number; currentLevelXp: number; nextLevelXp: number; progress: number };
  wallet: number;
  streak: { current: number; longest: number; lastActive: string | null };
  badges: { key: string; name: I18nText; icon: string; earned: boolean; earnedAt: string | null }[];
  subjects: { key: string; name: I18nText; color: string; icon: string; xp: number; level: { level: number; progress: number } }[];
  recentXp: { id: string; amount: number; reason: string; createdAt: string }[];
  walletTxs: { id: string; delta: number; reason: string; createdAt: string }[];
  activeDays: string[];
}

export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  gradeLevel: number | null;
  subjectId: string | null;
  courseId: string | null;
  sectionLabel: string | null;
  classroomCourseId: string | null;
  lastSyncedAt: string | null;
  syncError: string | null;
  settings: { leaderboardEnabled?: boolean };
  teachers: { id: string; name: string; avatarUrl: string | null; type: string }[];
  studentCount: number;
  missionCount: number;
}
