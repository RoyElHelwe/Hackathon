export const ROLES = ['DIRECTOR', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const;
export type Role = (typeof ROLES)[number];

export const MEMBERSHIP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MISSION_STATUSES = ['DRAFT', 'APPROVED', 'ARCHIVED'] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_AUDIENCES = ['STUDENT', 'FAMILY', 'SQUAD'] as const;
export type MissionAudience = (typeof MISSION_AUDIENCES)[number];

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SUBMISSION_STATUSES = [
  'IN_PROGRESS',
  'SUBMITTED',
  'AI_CHECKED',
  'FOLLOW_UP_ANSWERED',
  'PEER_REVIEW',
  'FAMILY_CONFIRM',
  'TEACHER_REVIEW',
  'VALIDATED',
  'RETRY',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const MASTERY_STATES = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'MASTERED'] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];

export const XP_REASONS = [
  'MISSION_VALIDATED',
  'FIRST_TRY',
  'FOLLOW_UP',
  'PEER_EVAL_GIVEN',
  'HELPFUL_REVIEW',
  'STREAK',
  'FAMILY_MISSION',
  'STUDY_SESSION',
  'EXAM_DONE',
] as const;
export type XpReason = (typeof XP_REASONS)[number];

export const NOTIFICATION_TYPES = [
  'LEVEL_UP',
  'BADGE',
  'PEER_REVIEW_ASSIGNED',
  'STUCK_ALERT',
  'MISSION_PUBLISHED',
  'SUMMARY_READY',
  'MEMBER_PENDING',
  'SUBMISSION_VALIDATED',
  'STUDY_INVITE',
  'STUDY_ACCEPTED',
  'EXAM_SCHEDULED',
  'EXAM_OPEN',
  'EXAM_RESULT_RELEASED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const LOCALES = ['en', 'ar', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

/** Multilingual text stored as JSON in the DB. */
export type I18nText = { en: string; ar?: string; fr?: string };

export function pickText(t: I18nText | string | null | undefined, locale: string): string {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const v = (t as Record<string, string | undefined>)[locale];
  return v ?? t.en ?? '';
}

/**
 * Picks the locale variant of a localized JSON value: `{ en: X, ar?: X }` → X.
 * Non-localized values are returned as-is, so this works for strings, arrays and objects.
 */
export function localized<T>(value: T | { en: T; ar?: T; fr?: T } | null | undefined, locale: string): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value) && 'en' in (value as object)) {
    const v = value as unknown as Record<string, T | undefined>;
    return v[locale] ?? v.en;
  }
  return value as T;
}
