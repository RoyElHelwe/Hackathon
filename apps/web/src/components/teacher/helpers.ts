import type { MasteryState, SubmissionStatus } from '@tajriba/shared';
import { ApiError } from '@/lib/api';

/** Mastery uses three colors only: red below 50 %, blue 50–69 %, cedar 70 % and up. */
export type Band = 'low' | 'mid' | 'high';
export const band = (score: number): Band => (score >= 70 ? 'high' : score >= 50 ? 'mid' : 'low');
export const BAND_SOLID: Record<Band, string> = { high: 'bg-cedar text-white', mid: 'bg-med text-white', low: 'bg-flag text-white' };
export const BAND_BAR: Record<Band, string> = { high: 'bg-cedar', mid: 'bg-med', low: 'bg-flag' };
export const BAND_TEXT: Record<Band, string> = {
  high: 'text-cedar-d dark:text-success',
  mid: 'text-med-d dark:text-med',
  low: 'text-flag-d dark:text-danger',
};
/** CSS colors for charts (recharts takes raw values). */
export const BAND_VAR: Record<Band, string> = { high: 'var(--cedar)', mid: 'var(--med)', low: 'var(--flag)' };

/** Heatmap cell colors per mastery state when there is no score to color by (token-based, dark-mode safe). */
export const MASTERY_CELL: Record<MasteryState, string> = {
  MASTERED: 'bg-cedar text-white',
  IN_PROGRESS: 'bg-med-soft text-med-ink dark:text-white',
  AVAILABLE: 'border-2 border-dashed border-lock-d bg-card text-muted-foreground',
  LOCKED: 'bg-lock text-muted-foreground/70',
};

/** Larger tiles (skill map) carry text. */
export const MASTERY_TILE: Record<MasteryState, string> = {
  MASTERED: 'border-cedar/40 bg-cedar-soft text-cedar-ink dark:text-white',
  IN_PROGRESS: 'border-med/40 bg-med-soft text-med-ink dark:text-white',
  AVAILABLE: 'border-border bg-card text-foreground',
  LOCKED: 'border-transparent bg-lock text-muted-foreground',
};

/** Static class maps so Tailwind can see every class (subject colors keep their legacy names). */
export const SUBJECT_DOT: Record<string, string> = {
  violet: 'bg-cedar',
  sky: 'bg-med',
  mint: 'bg-mint',
  green: 'bg-green',
  coral: 'bg-flag',
  sunny: 'bg-sunny',
  pink: 'bg-flag',
  slate: 'bg-muted-foreground',
};

export const SUBJECT_SOFT: Record<string, string> = {
  violet: 'bg-cedar-soft',
  sky: 'bg-med-soft',
  mint: 'bg-mint-soft',
  green: 'bg-green-soft',
  coral: 'bg-flag-soft',
  sunny: 'bg-sunny-soft',
  pink: 'bg-flag-soft',
  slate: 'bg-muted',
};

/** Solid header color of a class / course card. */
export const SUBJECT_SOLID: Record<string, string> = {
  violet: 'bg-cedar',
  sky: 'bg-med',
  mint: 'bg-cedar',
  green: 'bg-cedar',
  coral: 'bg-flag',
  sunny: 'bg-flame',
  pink: 'bg-flag',
  slate: 'bg-med',
};

export type BadgeVariant = 'default' | 'mint' | 'sunny' | 'coral' | 'sky' | 'muted' | 'outline';

export const STATUS_VARIANT: Record<SubmissionStatus, BadgeVariant> = {
  IN_PROGRESS: 'sky',
  SUBMITTED: 'sky',
  AI_CHECKED: 'default',
  FOLLOW_UP_ANSWERED: 'default',
  PEER_REVIEW: 'default',
  FAMILY_CONFIRM: 'sunny',
  TEACHER_REVIEW: 'coral',
  VALIDATED: 'mint',
  RETRY: 'sunny',
};

export const FLAG_VARIANT: Record<string, BadgeVariant> = {
  possible_copy: 'coral',
  fairness_gap: 'sunny',
  explanation_missing: 'sky',
  photo_unrelated: 'coral',
  numbers_unrealistic: 'sunny',
};

export const KNOWN_FLAGS = Object.keys(FLAG_VARIANT);

/** Friendly message from any thrown error. */
export function errMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError || e instanceof Error) return e.message || fallback;
  return fallback;
}

export function scoreTone(score: number) {
  return BAND_TEXT[band(score)];
}
