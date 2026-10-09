import type { MasteryState, SubmissionStatus } from '@tajriba/shared';
import { ApiError } from '@/lib/api';

/** Heatmap / skill tile colors per mastery state (token-based, dark-mode safe). */
export const MASTERY_CELL: Record<MasteryState, string> = {
  MASTERED: 'bg-mint text-ink',
  IN_PROGRESS: 'bg-sunny text-ink',
  AVAILABLE: 'bg-sky-soft text-sky dark:text-white',
  LOCKED: 'bg-muted text-muted-foreground',
};

/** Larger tiles (skill map) carry text, so AVAILABLE uses foreground text for contrast. */
export const MASTERY_TILE: Record<MasteryState, string> = {
  MASTERED: 'bg-mint text-ink',
  IN_PROGRESS: 'bg-sunny text-ink',
  AVAILABLE: 'bg-sky-soft text-foreground ring-1 ring-inset ring-sky/40',
  LOCKED: 'bg-muted text-muted-foreground',
};

/** Static class maps so Tailwind can see every class. */
export const SUBJECT_DOT: Record<string, string> = {
  violet: 'bg-violet',
  sky: 'bg-sky',
  mint: 'bg-mint',
  green: 'bg-green',
  coral: 'bg-coral',
  sunny: 'bg-sunny',
  pink: 'bg-coral',
  slate: 'bg-muted-foreground',
};

export const SUBJECT_SOFT: Record<string, string> = {
  violet: 'bg-violet-soft',
  sky: 'bg-sky-soft',
  mint: 'bg-mint-soft',
  green: 'bg-green-soft',
  coral: 'bg-coral-soft',
  sunny: 'bg-sunny-soft',
  pink: 'bg-coral-soft',
  slate: 'bg-muted',
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
  if (score >= 70) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-danger';
}
