import type { ArzinoMood } from '@/components/arzino';

/** One color per role (DESIGN.md §2): Student cedar · Teacher blue · Director/School red · Parent flame. */
export const ROLE_STYLE: Record<string, { solid: string; soft: string; text: string; edge: string; mood: ArzinoMood }> = {
  STUDENT: { solid: 'bg-cedar text-white', soft: 'bg-cedar-soft', text: 'text-cedar-ink dark:text-success', edge: '[--press:var(--cedar-d)]', mood: 'cheer' },
  TEACHER: { solid: 'bg-med text-white', soft: 'bg-med-soft', text: 'text-med-ink dark:text-white', edge: '[--press:var(--med-d)]', mood: 'teaching' },
  DIRECTOR: { solid: 'bg-flag text-white', soft: 'bg-flag-soft', text: 'text-flag-d dark:text-danger', edge: '[--press:var(--flag-d)]', mood: 'clipboard' },
  ADMIN: { solid: 'bg-flag text-white', soft: 'bg-flag-soft', text: 'text-flag-d dark:text-danger', edge: '[--press:var(--flag-d)]', mood: 'clipboard' },
  PARENT: { solid: 'bg-flame text-white', soft: 'bg-flame-soft', text: 'text-flame-d dark:text-warning', edge: '[--press:var(--flame-d)]', mood: 'warm' },
};

export const roleStyle = (role: string) => ROLE_STYLE[role] ?? ROLE_STYLE.STUDENT;
