export interface StuckInput {
  retriesOnTopic: number;
  hintsWithoutSubmit: number;
  inProgressSince: Date | null;
  now: Date;
}

export type StuckReason = 'RETRIES' | 'HINTS' | 'IDLE';

export const STUCK_IDLE_MS = 48 * 60 * 60 * 1000;

/** CLAUDE.md §6 stuck detection: ≥2 RETRY, ≥3 hints without submitting, or IN_PROGRESS > 48h. */
export function stuckReasons(input: StuckInput): StuckReason[] {
  const reasons: StuckReason[] = [];
  if (input.retriesOnTopic >= 2) reasons.push('RETRIES');
  if (input.hintsWithoutSubmit >= 3) reasons.push('HINTS');
  if (input.inProgressSince && input.now.getTime() - input.inProgressSince.getTime() > STUCK_IDLE_MS) reasons.push('IDLE');
  return reasons;
}

/** A topic becomes AVAILABLE once all its prerequisites are mastered. */
export function unlockedTopics(
  topics: { id: string; prerequisiteIds: string[] }[],
  mastered: Set<string>,
): string[] {
  return topics
    .filter((t) => !mastered.has(t.id) && t.prerequisiteIds.every((p) => mastered.has(p)))
    .map((t) => t.id);
}
