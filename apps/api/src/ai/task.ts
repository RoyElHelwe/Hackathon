import type { ZodType } from 'zod';

export type ModelKind = 'fast' | 'vision';

/** One AI task = prompt + output schema + deterministic mock (used when AI_PROVIDER=mock). */
export interface TaskDef<I, O> {
  name: string;
  model: ModelKind;
  schema: ZodType<O>;
  system: string;
  user: (input: I) => string;
  mock: (input: I) => O;
}

export function defineTask<I, O>(def: TaskDef<I, O>): TaskDef<I, O> {
  return def;
}

export const JSON_RULES =
  'Return ONLY a single JSON object that matches the schema described. No markdown, no code fences, no commentary. ' +
  'Never include or ask for personal data (names, emails, addresses). Refer to the learner as "the student".';

export const LANG: Record<string, string> = { en: 'English', ar: 'Arabic (Modern Standard, simple words for 13-year-olds)', fr: 'French' };
export const lang = (locale?: string) => LANG[locale ?? 'en'] ?? 'English';

/** Small deterministic hash so mocks vary by input but stay stable. */
export function stableNumber(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}
