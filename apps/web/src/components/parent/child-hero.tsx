'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { LevelRing, StreakFlame } from '@/components/kid/stats';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { useL } from '@/lib/hooks';
import type { ParentDashboard } from './types';

/** Warm hero: who the child is, level, streak, badges and classes. */
export function ChildHero({ data }: { data: ParentDashboard }) {
  const t = useTranslations('parent.dashboard');
  const l = useL();
  const sep = useLocale() === 'ar' ? '، ' : ', ';
  const earned = data.badges.filter((b) => b.earned);
  const teachers = [...new Set(data.classes.flatMap((c) => c.teachers.map((x) => x.name)))];

  return (
    <Card className="relative overflow-hidden" data-testid="child-hero">
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-violet-soft opacity-70 dark:opacity-40" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -start-10 size-48 rounded-full bg-mint-soft opacity-60 dark:opacity-30" />
      <div className="relative flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={data.child.name} src={data.child.avatarUrl} className="size-16 text-xl ring-4 ring-card" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-extrabold leading-tight" data-testid="child-name">
              {data.child.name}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
              {t('level', { level: data.level.level })} · {t('xp', { xp: data.xp })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StreakFlame days={data.streak.current} compact />
              <span className="text-sm font-semibold text-muted-foreground">{t('streak', { days: data.streak.current })}</span>
            </div>
          </div>
          <div className="shrink-0">
            <LevelRing level={data.level.level} progress={data.level.progress} size={84} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t('badges')}</p>
          {earned.length ? (
            <div className="flex flex-wrap gap-2">
              {earned.map((b) => (
                <span key={b.key} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-bold" data-testid="child-badge">
                  <span className="text-lg" aria-hidden>
                    {b.icon}
                  </span>
                  {l(b.name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noBadges')}</p>
          )}
        </div>

        {data.classes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-muted/70 p-3">
            <div className="min-w-0 text-sm">
              <span className="font-extrabold">{data.classes.map((c) => c.name).join(' · ')}</span>
              {teachers.length > 0 && <span className="text-muted-foreground"> — {t('teacher', { names: teachers.join(sep) })}</span>}
            </div>
            <Button asChild variant="outline" size="sm">
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
