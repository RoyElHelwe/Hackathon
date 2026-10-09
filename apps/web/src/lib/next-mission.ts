'use client';

import { useApi } from './hooks';
import type { Mission } from './types';

export const ACTIVE_STATUSES = ['IN_PROGRESS', 'AI_CHECKED', 'RETRY', 'SUBMITTED'];

/**
 * The mission the student should do next: one already in progress, else the oldest open mission on an unlocked
 * topic, else the last open one. Family missions are never picked (they are done with a parent).
 */
export function pickNextMission(list: Mission[], progress: { topicId: string; state: string }[] | undefined): Mission | null {
  const active = list.find((m) => m.mySubmission && ACTIVE_STATUSES.includes(m.mySubmission.status) && m.audience !== 'FAMILY');
  if (active) return active;
  const mastered = new Set(progress?.filter((p) => p.state === 'MASTERED').map((p) => p.topicId));
  const open = list.filter((m) => !m.mySubmission && m.audience !== 'FAMILY' && !mastered.has(m.topicId));
  // Prefer topics that are unlocked (AVAILABLE/IN_PROGRESS), oldest mission first.
  const unlocked = new Set(progress?.filter((p) => p.state === 'AVAILABLE' || p.state === 'IN_PROGRESS').map((p) => p.topicId));
  return [...open].reverse().find((m) => unlocked.has(m.topicId)) ?? open[open.length - 1] ?? null;
}

/** Same pick, loading its own data (used where the page doesn't already have missions and progress). */
export function useNextMission() {
  const missions = useApi<Mission[]>('/missions');
  const progress = useApi<{ topicId: string; state: string }[]>('/progress/me');
  return {
    mission: missions.data ? pickNextMission(missions.data, progress.data) : null,
    isLoading: missions.isLoading || progress.isLoading,
  };
}
