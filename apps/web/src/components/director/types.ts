import type { I18nText, Role } from '@tajriba/shared';

export interface SchoolSettings {
  gradeLevels?: number[];
  safetyRules?: string[];
  defaultLocale?: 'en' | 'ar' | 'fr';
  leaderboardPolicy?: 'TEACHER_CHOICE' | 'ALWAYS_OFF';
}

export interface School {
  id: string;
  name: string;
  city: string;
  schoolCode: string;
  settings: SchoolSettings;
}

export interface DirectorClass {
  id: string;
  name: string;
  gradeLevel: number | null;
  teachers: string[];
  students: number;
  engagement: number;
  stuckCount: number;
  avgMastery: number;
  classroomLinked: boolean;
}

export interface CoverageRow {
  topicId: string;
  topicKey: string;
  topicName: I18nText;
  subjectKey: string;
  subjectName: I18nText;
  color: string;
  gradeLevel: number;
  classes: { classId: string; pct: number }[];
}

export interface DirectorDashboard {
  school: School;
  kpis: {
    activeStudentsWeek: number;
    totalStudents: number;
    missionsValidated: number;
    missionsValidatedWeek: number;
    avgMastery: number;
    parentParticipation: number;
    pendingMembers: number;
  };
  trend: { day: string; validated: number }[];
  classes: DirectorClass[];
  coverage: CoverageRow[];
  classList: { id: string; name: string }[];
}

export interface SchoolSubject {
  id: string;
  key: string;
  name: { en: string; ar?: string };
  color: string;
  icon: string;
  classCount: number;
  teacherCount: number;
  topicCount: number;
}

export interface Member {
  id: string;
  role: Role;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  subjects: { id: string; name: { en: string; ar?: string } }[];
}
