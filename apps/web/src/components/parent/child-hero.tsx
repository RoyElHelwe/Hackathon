'use client';

import { Flame, MessageCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { EYEBROW } from '@/components/director/tone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, Progress } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import { firstName, type ParentDashboard } from './types';

/** Warm hero: a big proud Arzino, the child's week in three big numbers, badges and the teacher. */
export function ChildHero({ data }: { data: ParentDashboard }) {
  const t = useTranslations('parent.dashboard');
  const l = useL();
  const sep = useLocale() === 'ar' ? '، ' : ', ';
  const earned = data.badges.filter((b) => b.earned);
  const teachers = [...new Set(data.classes.flatMap((c) => c.teachers.map((x) => x.name)))];
  const name = firstName(data.child.name);
  const proud = data.streak.current >= 3 || earned.length > 0;

  return (
    <Card className="relative overflow-hidden" data-testid="child-hero">
      <div className="relative flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-5">
          <Arzino mood={proud ? 'proud' : 'warm'} size={132} pop priority className="-my-3 -ms-2 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className={cn(EYEBROW, 'inline-flex rounded-full bg-flame-soft px-2.5 py-1 text-flame-d dark:text-warning')}>{t('eyebrow')}</span>
            <h1 className="mt-1.5 text-[28px] font-black leading-tight tracking-tight sm:text-[34px]">{t('title', { name })}</h1>
            <p className="mt-1 flex min-w-0 items-center gap-2 font-semibold text-muted-foreground">
              <Avatar name={data.child.name} src={data.child.avatarUrl} className="size-7 text-[11px]" />
              <span className="truncate" data-testid="child-name">
                {data.child.name}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile tone="cedar" value={data.level.level} label={t('statLevel')}>
            <Progress value={data.level.progress * 100} className="mt-2 h-2.5" barClassName="bg-cedar" />
          </StatTile>
          <StatTile tone="med" value={data.xp} label={t('statXp')} icon={<Zap className="size-5 fill-current" />} />
          <StatTile tone="flame" value={data.streak.current} label={t('statStreak', { days: data.streak.current })} icon={<Flame className="size-5 fill-current" />} />
        </div>

        <div>
          <p className={cn(EYEBROW, 'mb-2 text-muted-foreground')}>{t('badges')}</p>
          {earned.length ? (
            <div className="flex flex-wrap gap-2">
              {earned.map((b) => (
                <span
                  key={b.key}
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] border-2 border-border bg-card px-3 text-sm font-extrabold shadow-[0_3px_0_var(--border)]"
                  data-testid="child-badge"
                >
                  <span className="text-lg" aria-hidden>
                    {b.icon}
                  </span>
                  {l(b.name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">{t('noBadges', { name })}</p>
          )}
        </div>

        {data.classes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-muted p-3">
            <div className="min-w-0 text-sm">
              <span className="font-black">{data.classes.map((c) => c.name).join(' · ')}</span>
              {teachers.length > 0 && <span className="font-semibold text-muted-foreground"> — {t('teacher', { names: teachers.join(sep) })}</span>}
            </div>
            <Button asChild variant="kidGhost" size="sm">
              <Link href="/parent/messages">
                <MessageCircle /> {t('message')}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

const TONE = {
  cedar: 'text-cedar-ink dark:text-success',
  med: 'text-med-ink dark:text-ring',
  flame: 'text-flame-d dark:text-warning',
} as const;

function StatTile({ tone, value, label, icon, children }: { tone: keyof typeof TONE; value: number; label: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[18px] border-2 border-border bg-card p-3 shadow-[0_4px_0_var(--border)] sm:p-4">
      <p className={cn('flex items-center gap-1 font-display text-[28px] font-black leading-none tabular-nums sm:text-[34px]', TONE[tone])}>
        {icon}
        {value}
      </p>
      <p className="mt-1 text-xs font-extrabold leading-tight text-muted-foreground sm:text-sm">{label}</p>
      {children}
    </div>
  );
}
