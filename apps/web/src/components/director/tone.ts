/** The 3-color mastery rule from the design: red below 50 %, blue 50–69 %, cedar 70 % and up. */
export type Tone = 'flag' | 'med' | 'cedar';

export const masteryTone = (pct: number): Tone => (pct >= 70 ? 'cedar' : pct >= 50 ? 'med' : 'flag');

export const TONE_BAR: Record<Tone, string> = { flag: 'bg-flag', med: 'bg-med', cedar: 'bg-cedar' };
export const TONE_TEXT: Record<Tone, string> = {
  flag: 'text-flag-d dark:text-danger',
  med: 'text-med-ink dark:text-ring',
  cedar: 'text-cedar-ink dark:text-success',
};
export const TONE_SOFT: Record<Tone, string> = {
  flag: 'bg-flag-soft text-flag-d dark:text-danger',
  med: 'bg-med-soft text-med-ink dark:text-ring',
  cedar: 'bg-cedar-soft text-cedar-ink dark:text-success',
};

/** Same as the global `.eyebrow`, but as utilities so a color class can override it (`.eyebrow` is unlayered and would win). */
export const EYEBROW = 'text-[12px] font-black uppercase leading-snug tracking-[0.09em]';
