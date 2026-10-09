'use client';

import { Arzino, type ArzinoMood } from '@/components/arzino';
import { cn } from '@/lib/cn';
import { EYEBROW } from './tone';

const ACCENT = {
  flag: 'text-flag-d dark:text-danger',
  flame: 'text-flame-d dark:text-warning',
} as const;

/** Page header from the design: Arzino on the start side, a colored eyebrow, one big title and at most one line. */
export function PageHero({
  mood,
  eyebrow,
  title,
  subtitle,
  actions,
  accent = 'flag',
  size = 112,
  className,
}: {
  mood: ArzinoMood;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  accent?: keyof typeof ACCENT;
  size?: number;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-center gap-x-5 gap-y-3', className)}>
      <Arzino mood={mood} size={size} pop priority className="-my-2" />
      <div className="min-w-0 flex-1 basis-56">
        {eyebrow && <p className={cn(EYEBROW, ACCENT[accent])}>{eyebrow}</p>}
        <h1 className="mt-0.5 text-[28px] font-black leading-tight tracking-tight md:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 font-semibold text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
