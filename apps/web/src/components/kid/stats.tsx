'use client';

import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';

export function StreakFlame({ days, compact, className }: { days: number; compact?: boolean; className?: string }) {
  const t = useTranslations('student');
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full bg-coral-soft px-3 font-extrabold text-coral', compact ? 'h-9 text-sm' : 'h-11 text-base', className)} title={t('streakDays', { days })} data-testid="streak">
      <span className={cn(days > 0 && 'flame', 'inline-block')} aria-hidden>
        🔥
      </span>
      {days}
    </div>
  );
}

export function Coins({ points, compact, className }: { points: number; compact?: boolean; className?: string }) {
  const t = useTranslations('student');
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full bg-sunny-soft px-3 font-extrabold text-warning', compact ? 'h-9 text-sm' : 'h-11 text-base', className)} title={t('walletPoints', { points })} data-testid="wallet">
      <span aria-hidden>🪙</span>
      {points}
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
      <div className="mb-1 flex justify-between text-sm font-bold text-muted-foreground">
        <span>
          <CountUp value={xp} /> XP
        </span>
        <span>{t('nextLevelAt', { xp: nextLevelXp })}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} data-testid="xp-bar">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet via-sky to-mint"
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
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} data-testid="level-ring">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="var(--muted)" strokeWidth="10" fill="none" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          stroke="url(#lvl)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.03, progress)) }}
          transition={{ type: 'spring', stiffness: 50, damping: 14 }}
        />
        <defs>
          <linearGradient id="lvl" x1="0" x2="1">
            <stop offset="0" stopColor="#6C4CF1" />
            <stop offset="1" stopColor="#2DD4A7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center leading-none">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{t('level')}</div>
        <div className="font-display text-3xl font-extrabold text-primary" data-testid="level-number">
          {level}
        </div>
      </div>
    </div>
  );
}
