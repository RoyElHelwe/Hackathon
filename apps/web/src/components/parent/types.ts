import type { I18nText, MasteryState, SubmissionStatus } from '@tajriba/shared';
import type { Mission } from '@/lib/types';

export type StuckReason = 'RETRIES' | 'HINTS' | 'IDLE';

export interface ParentDashboard {
  child: { id: string; name: string; avatarUrl: string | null };
  level: { level: number; progress: number; xp: number; nextLevelXp: number };
  xp: number;
  streak: { current: number; longest?: number };
  badges: { key: string; name: I18nText; icon: string; earned: boolean }[];
  classes: { id: string; name: string; teachers: { id: string; name: string }[] }[];
  strengths: { topicKey: string; topicName: I18nText; bestScore: number }[];
  struggles: { topicKey: string; topicName: I18nText; reasons: StuckReason[] }[];
  recentWork: {
    submissionId: string;
    status: SubmissionStatus;
    title: I18nText;
    subjectKey: string;
    audience: 'STUDENT' | 'FAMILY' | 'SQUAD';
    photoUploadIds: string[];
    finalScore: number | null;
    at: string;
  }[];
}

export interface WeeklySummary {
  weekStart: string;
  locale: string;
  content: { highlights: string[]; struggles: string[]; howToHelp: string; suggestedFamilyMission: string };
}

export interface MiniGraph {
  nodes: { id: string; key: string; name: I18nText; icon: string; state: MasteryState; bestScore: number; gradeLevel: number }[];
  edges: { id: string; source: string; target: string }[];
}

export interface ChildSubmission {
  id: string;
  status: SubmissionStatus;
  child: { id: string; firstName: string };
  photoUploadIds: string[];
  explanation: string | null;
  submittedAt: string | null;
  confirmation: { note: string | null; confirmedAt: string } | null;
}

export type FamilyMission = Mission & { childSubmissions: ChildSubmission[] };

export const firstName = (name: string) => name.split(' ')[0] ?? name;
