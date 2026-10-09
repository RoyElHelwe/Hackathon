import { dayKey, STREAK_TZ } from './gamification';

/**
 * School calendar helpers (Asia/Beirut). Dates are handled as "YYYY-MM-DD" day keys and UTC-midnight Date
 * objects (what Prisma `@db.Date` columns hold). Day index: 0 = Monday … 6 = Sunday.
 */

/** UTC-midnight Date for a day key ("2026-10-12"). */
export function dateOfKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** Day key of a UTC-midnight Date (as stored in `@db.Date`). */
export function keyOfDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday-based weekday index (0 = Monday) of a day key. */
export function weekdayOfKey(key: string): number {
  return (dateOfKey(key).getUTCDay() + 6) % 7;
}

export function addDaysKey(key: string, n: number): string {
  const d = dateOfKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOfDate(d);
}

/** Today in Beirut, as a day key. */
export function todayKey(now = new Date(), timeZone = STREAK_TZ): string {
  return dayKey(now, timeZone);
}

/** Is this day key a school day for a school working `days` days a week (5 = Mon–Fri, 6 = Mon–Sat)? */
export function isSchoolDay(key: string, days = 5): boolean {
  return weekdayOfKey(key) < days;
}

/** The next school day strictly after `key`. */
export function nextSchoolDayKey(key: string, days = 5): string {
  let k = addDaysKey(key, 1);
  while (!isSchoolDay(k, days)) k = addDaysKey(k, 1);
  return k;
}

/** The previous school day strictly before `key`. */
export function prevSchoolDayKey(key: string, days = 5): string {
  let k = addDaysKey(key, -1);
  while (!isSchoolDay(k, days)) k = addDaysKey(k, -1);
  return k;
}

/** Today if it is a school day, otherwise the next one (weekends roll forward). */
export function schoolDayOrNext(key: string, days = 5): string {
  return isSchoolDay(key, days) ? key : nextSchoolDayKey(key, days);
}

/** Monday of the week containing `key`. */
export function mondayOfKey(key: string): string {
  return addDaysKey(key, -weekdayOfKey(key));
}

/** The school week to show "now": this week on school days, next week on the weekend. */
export function currentSchoolWeekMonday(now = new Date(), days = 5): string {
  return mondayOfKey(schoolDayOrNext(todayKey(now), days));
}

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/**
 * Resolve a spoken day ("today", "tomorrow", "tue", or an ISO date) to a school day key. Weekday names mean the
 * next such day (today included). Non-school days roll forward to the next school day.
 */
export function resolveSchoolDay(when: string | undefined, now = new Date(), days = 5): string {
  const today = todayKey(now);
  if (!when || when === 'today') return schoolDayOrNext(today, days);
  if (when === 'tomorrow') return schoolDayOrNext(addDaysKey(today, 1), days);
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) return schoolDayOrNext(when, days);
  const idx = WEEKDAY_KEYS.indexOf(when as WeekdayKey);
  if (idx < 0) return schoolDayOrNext(today, days);
  const delta = (idx - weekdayOfKey(today) + 7) % 7;
  return schoolDayOrNext(addDaysKey(today, delta), days);
}
