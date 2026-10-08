import type { Difficulty } from './enums';

export const BASE_XP: Record<Difficulty, number> = { EASY: 30, MEDIUM: 50, HARD: 80 };

export const XP_BONUS = {
  FIRST_TRY: 10,
  FOLLOW_UP: 10,
  PEER_EVAL_GIVEN: 15,
  HELPFUL_REVIEW: 5,
  FAMILY_MISSION: 20,
} as const;

export const STREAK_MILESTONES: Record<number, number> = { 3: 15, 7: 30, 14: 60 };

export const WALLET_START = 3;
export const PEER_PASS_SCORE = 70;
export const TEACHER_PASS_SCORE = 70;
export const AI_RETRY_BELOW = 50;
export const FAIRNESS_GAP = 25;
export const MAX_OPEN_REVIEWS = 3;

/** Total XP needed to reach level n. L1 = 0, L2 = 100, L3 = 300, L4 = 600, L5 = 1000. */
export function xpForLevel(n: number): number {
  return 50 * n * (n - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelInfo {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  /** 0..1 progress inside the current level */
  progress: number;
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: (xp - currentLevelXp) / (nextLevelXp - currentLevelXp),
  };
}

export interface MissionXpInput {
  difficulty: Difficulty;
  attempt: number;
  followUpUnderstood: boolean;
  family: boolean;
}

export interface XpAward {
  reason: 'MISSION_VALIDATED' | 'FIRST_TRY' | 'FOLLOW_UP' | 'FAMILY_MISSION';
  amount: number;
}

export function missionXp(input: MissionXpInput): XpAward[] {
  const awards: XpAward[] = [{ reason: 'MISSION_VALIDATED', amount: BASE_XP[input.difficulty] }];
  if (input.attempt === 1) awards.push({ reason: 'FIRST_TRY', amount: XP_BONUS.FIRST_TRY });
  if (input.followUpUnderstood) awards.push({ reason: 'FOLLOW_UP', amount: XP_BONUS.FOLLOW_UP });
  if (input.family) awards.push({ reason: 'FAMILY_MISSION', amount: XP_BONUS.FAMILY_MISSION });
  return awards;
}

// ---------- Streaks (timezone Asia/Beirut) ----------

export const STREAK_TZ = 'Asia/Beirut';

/** Calendar day (YYYY-MM-DD) of an instant in the given timezone. */
export function dayKey(date: Date, timeZone = STREAK_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export interface StreakState {
  current: number;
  longest: number;
  lastActive: Date | null;
}

export interface StreakUpdate extends StreakState {
  /** XP bonus earned by hitting a milestone today (0 if none) */
  milestoneXp: number;
  changed: boolean;
}

export function applyActivity(state: StreakState, now: Date): StreakUpdate {
  const today = dayKey(now);
  if (state.lastActive) {
    const last = dayKey(state.lastActive);
    const diff = dayDiff(last, today);
    if (diff <= 0) return { ...state, milestoneXp: 0, changed: false };
    const current = diff === 1 ? state.current + 1 : 1;
    return {
      current,
      longest: Math.max(state.longest, current),
      lastActive: now,
      milestoneXp: STREAK_MILESTONES[current] ?? 0,
      changed: true,
    };
  }
  return { current: 1, longest: Math.max(1, state.longest), lastActive: now, milestoneXp: 0, changed: true };
}

// ---------- Final score ----------

export function finalScore(input: { teacher?: number | null; ai?: number | null; peer?: number | null }): number {
  if (input.teacher != null) return input.teacher;
  if (input.ai != null && input.peer != null) return Math.round(0.6 * input.ai + 0.4 * input.peer);
  return input.ai ?? 0;
}

// ---------- Badges ----------

export interface BadgeStats {
  validatedCount: number;
  validatedTopicKeys: string[];
  evaluationsDone: number;
  helpfulRatingsReceived: number;
  streakCurrent: number;
  familyMissions: number;
}

export const BADGE_RULES: Record<string, (s: BadgeStats) => boolean> = {
  first_mission: (s) => s.validatedCount >= 1,
  shadow_hunter: (s) => s.validatedTopicKeys.includes('geo.similar'),
  architect: (s) => s.validatedTopicKeys.filter((k) => k === 'geo.area' || k === 'geo.volume').length >= 3,
  pizza_master: (s) => s.validatedTopicKeys.includes('geo.circles'),
  peer_hero: (s) => s.evaluationsDone >= 5,
  kind_reviewer: (s) => s.helpfulRatingsReceived >= 3,
  streak_7: (s) => s.streakCurrent >= 7,
  family_team: (s) => s.familyMissions >= 2,
  kitchen_chemist: (s) => s.validatedTopicKeys.some((k) => k.startsWith('chem.')),
  time_traveler: (s) => s.validatedTopicKeys.some((k) => k.startsWith('his.')),
};

export function earnedBadges(stats: BadgeStats, alreadyEarned: string[]): string[] {
  return Object.entries(BADGE_RULES)
    .filter(([key, rule]) => !alreadyEarned.includes(key) && rule(stats))
    .map(([key]) => key);
}
