'use client';

import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';

/** Stat chip sizes: `compact` = header pill, `bare` = Duolingo stat bar (icon + number, no pill). */
type ChipProps = { compact?: boolean; bare?: boolean; className?: string };

const chip = (compact?: boolean, bare?: boolean) =>
  bare ? 'h-10 px-1.5 text-[17px]' : cn('rounded-full px-3', compact ? 'h-9 text-sm' : 'h-11 text-base');

export function StreakFlame({ days, compact, bare, className }: { days: number } & ChipProps) {
  const t = useTranslations('student');
  return (
    <div
      className={cn('inline-flex items-center gap-1 font-black tabular-nums', days > 0 ? 'text-flame-d dark:text-flame' : 'text-muted-foreground', !bare && 'bg-flame-soft', chip(compact, bare), className)}
      title={t('streakDays', { days })}
      data-testid="streak"
    >
      <span className={cn(days > 0 ? 'flame' : 'grayscale', 'inline-block', bare && 'text-xl')} aria-hidden>
        🔥
      </span>
      {days}
    </div>
  );
}

export function Coins({ points, compact, bare, className }: { points: number } & ChipProps) {
  const t = useTranslations('student');
  return (
    <div className={cn('inline-flex items-center gap-1 font-black tabular-nums text-med-ink dark:text-white', !bare && 'bg-med-soft', chip(compact, bare), className)} title={t('walletPoints', { points })} data-testid="wallet">
      <span className={cn(bare && 'text-xl')} aria-hidden>
        🪙
      </span>
      {points}
    </div>
  );
}

/** Lightning bolt + XP total, in Mediterranean blue. */
export function XpStat({ xp, className }: { xp: number; className?: string }) {
  const t = useTranslations('student');
  return (
    <div className={cn('inline-flex h-10 items-center gap-1 px-1.5 text-[17px] font-black tabular-nums text-med-ink dark:text-med', className)} title={t('xp', { xp })} data-testid="xp-stat">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6L13.5 2Z" fill="var(--med)" stroke="var(--med-d)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <CountUp value={xp} />
    </div>
  );
}

/** Little cedar + current level. */
export function LevelStat({ level, className }: { level: number; className?: string }) {
  const t = useTranslations('student');
  return (
    <div className={cn('inline-flex h-10 items-center gap-1 px-1.5 text-[17px] font-black tabular-nums text-cedar-ink dark:text-cedar', className)} title={`${t('level')} ${level}`}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M12 2 6.5 9h2.5L5 14h3.5L4 19.5h16L15.5 14H19l-4-5h2.5L12 2Z" fill="var(--cedar)" stroke="var(--cedar-d)" strokeWidth="1.2" strokeLinejoin="round" />
        <rect x="10.8" y="19" width="2.4" height="3.5" rx="0.8" fill="var(--cedar-d)" />
      </svg>
      {level}
    </div>
  );
}

/** Animated number that counts up when it changes. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: 'easeOut' });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

export function XpBar({ progress, xp, nextLevelXp, className }: { progress: number; xp: number; nextLevelXp: number; className?: string }) {
  const t = useTranslations('student');
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex justify-between gap-2 text-sm font-extrabold text-muted-foreground">
        <span className="text-med-ink dark:text-med">
          <CountUp value={xp} /> XP
        </span>
        <span>{t('nextLevelAt', { xp: nextLevelXp })}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-lock" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} data-testid="xp-bar">
        <motion.div
          className="bar-gloss h-full rounded-full bg-med"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, progress * 100)}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        />
      </div>
    </div>
  );
}

export function LevelRing({ level, progress, size = 92 }: { level: number; progress: number; size?: number }) {
  const t = useTranslations('student');
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} data-testid="level-ring">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="var(--lock)" strokeWidth="10" fill="none" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          stroke="var(--cedar)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.03, progress)) }}
          transition={{ type: 'spring', stiffness: 50, damping: 14 }}
        />
      </svg>
      <div className="text-center leading-none">
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t('level')}</div>
        <div className="font-display text-3xl font-black text-cedar" data-testid="level-number">
          {level}
        </div>
      </div>
    </div>
  );
}

/** Mon..Sun dots for the current week, filled when the student was active that day. */
export function WeekStreak({ activeDays, className }: { activeDays: string[]; className?: string }) {
  const t = useTranslations('student');
  const active = new Set(activeDays);
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const letters = t('weekLetters').split(',');
  return (
    <div className={cn('flex justify-between gap-1.5', className)} dir="ltr">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const on = active.has(iso);
        const isToday = d.toDateString() === today.toDateString();
        return (
          <div key={iso} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full text-sm font-black text-white',
                on ? 'bg-flame' : 'bg-lock',
                isToday && !on && 'ring-2 ring-flame ring-offset-2 ring-offset-card',
              )}
            >
              {on && (
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-[11px] font-black text-muted-foreground">{letters[i] ?? ''}</span>
          </div>
        );
      })}
    </div>
  );
}
