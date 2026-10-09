'use client';

import { ArrowRight, BookOpenCheck, Hourglass } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Bousla, BouslaSays } from '@/components/bousla';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { BadgeCard } from '@/components/kid/celebrations';
import { Coins, LevelRing, StreakFlame, XpBar } from '@/components/kid/stats';
import { InstallCard } from '@/components/student/install-card';
import { MissionCard, missionHref } from '@/components/student/mission-card';
import { RewardCelebration } from '@/components/student/reward-celebration';
import { TopicGlyph } from '@/components/app/subject-icon';
import { subjectStyle } from '@/components/student/subject-style';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApi, useL, useMe } from '@/lib/hooks';
import type { Gamification, Mission, NotificationItem, Rewards } from '@/lib/types';
import { cn } from '@/lib/cn';

const ACTIVE = ['IN_PROGRESS', 'AI_CHECKED', 'RETRY', 'SUBMITTED'];
const WAITING = ['PEER_REVIEW', 'TEACHER_REVIEW', 'FAMILY_CONFIRM'];

export default function StudentHome() {
  const t = useTranslations('student');
  const tc = useTranslations('common');
  const l = useL();
  const { data: me } = useMe();
  const g = useApi<Gamification>('/gamification/me');
  const missions = useApi<Mission[]>('/missions');
  const reviews = useApi<{ id: string; status: string; submitter: { firstName: string } }[]>('/peer-reviews/assigned');
  const notifications = useApi<NotificationItem[]>('/notifications');
  const progress = useApi<{ topicId: string; state: string }[]>('/progress/me');
  const [celebrated, setCelebrated] = useState(false);

  if (g.isLoading || missions.isLoading) return <PageSkeleton />;
  if (g.error || missions.error) return <ErrorState onRetry={() => { g.refetch(); missions.refetch(); }} />;
  const gm = g.data!;
  const list = missions.data ?? [];
  const active = list.find((m) => m.mySubmission && ACTIVE.includes(m.mySubmission.status) && m.audience !== 'FAMILY');
  const mastered = new Set(progress.data?.filter((p) => p.state === 'MASTERED').map((p) => p.topicId));
  const open = list.filter((m) => !m.mySubmission && m.audience !== 'FAMILY' && !mastered.has(m.topicId));
  // Prefer topics that are unlocked (AVAILABLE/IN_PROGRESS), oldest mission first.
  const unlocked = new Set(progress.data?.filter((p) => p.state === 'AVAILABLE' || p.state === 'IN_PROGRESS').map((p) => p.topicId));
  const next = [...open].reverse().find((m) => unlocked.has(m.topicId)) ?? open[open.length - 1];
  const waiting = list.filter((m) => m.mySubmission && WAITING.includes(m.mySubmission.status));
  const toReview = reviews.data?.filter((r) => r.status === 'ASSIGNED') ?? [];
  const badges = gm.badges.filter((b) => b.earned).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '')).slice(0, 4);
  const unseen = notifications.data?.find((n) => n.type === 'SUBMISSION_VALIDATED' && !n.readAt);
  const unseenRewards = unseen ? ({ ...(unseen.payload.rewards as Rewards), notificationId: unseen.id } as Rewards) : null;
  const feature = active ?? next;

  return (
    <div className="space-y-5">
      {unseenRewards && !celebrated && (
        <div className="relative">
          <RewardCelebration rewards={unseenRewards} onDone={() => setCelebrated(true)} />
        </div>
      )}

      <section className="flex items-center gap-4">
        <Bousla mood="happy" size={86} heading={50} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold leading-tight" data-testid="greeting">
            {t('greeting', { name: me?.user.name.split(' ')[0] ?? '' })}
          </h1>
          <p className="text-muted-foreground">{t('greetingSub')}</p>
        </div>
      </section>

      <Card className="flex items-center gap-4 p-4">
        <LevelRing level={gm.level.level} progress={gm.level.progress} />
        <div className="min-w-0 flex-1 space-y-3">
          <XpBar progress={gm.level.progress} xp={gm.xp} nextLevelXp={gm.level.nextLevelXp} />
          <div className="flex flex-wrap gap-2">
            <StreakFlame days={gm.streak.current} />
            <Coins points={gm.wallet} />
          </div>
        </div>
      </Card>

      {feature && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Link href={missionHref(feature)} data-testid="continue-mission">
            <div className={cn('relative overflow-hidden rounded-[28px] p-5 text-white shadow-xl', 'bg-gradient-to-br from-violet to-[#8B6CFF]')}>
              <div className="absolute -end-6 -top-6 text-[120px] opacity-20" aria-hidden>
                <TopicGlyph topicKey={feature.topic?.key} icon={feature.topic?.icon} />
              </div>
              <p className="text-sm font-bold uppercase tracking-wider text-white/80">{active ? t('continueMission') : t('nextMission')}</p>
              <p className="mt-1 font-display text-2xl font-extrabold leading-tight">{l(feature.title)}</p>
              <p className="mt-1 line-clamp-2 text-white/85">{l(feature.story)}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">⚡ {t('xp', { xp: feature.xpReward })} · {tc('minutes', { n: feature.estimatedMin })}</span>
                <span className="kid-press inline-flex h-12 items-center gap-2 rounded-full bg-sunny px-5 font-display text-lg font-bold text-ink [--press:#d99f12]">
                  {active ? t('resume') : t('go')} <ArrowRight className="rtl-flip size-5" />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {toReview.length > 0 && (
        <Link href="/student/reviews" data-testid="reviews-waiting">
          <Card className="flex items-center gap-4 border-2 border-sunny bg-sunny-soft p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-sunny text-ink">
              <BookOpenCheck className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold">{t('reviewsWaiting', { count: toReview.length })}</p>
              <p className="text-sm text-muted-foreground">{t('reviewsWaitingBody')}</p>
            </div>
            <Button variant="kidSunny" size="sm" tabIndex={-1}>
              {t('review')}
            </Button>
          </Card>
        </Link>
      )}

      {waiting.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-extrabold">
            <Hourglass className="size-5 text-sky" /> {t('waitingResults')}
          </h2>
          <div className="space-y-3">
            {waiting.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        </section>
      )}

      {badges.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xl font-extrabold">{t('latestBadges')}</h2>
            <Link href="/student/me" className="text-sm font-bold text-primary">
              {t('seeAll')}
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {badges.map((b) => (
              <BadgeCard key={b.key} icon={b.icon} name={b.name} size="sm" />
            ))}
          </div>
        </section>
      )}

      {gm.subjects.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gm.subjects.map((s) => (
            <span key={s.key} className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold', subjectStyle(s.key, s.color, s.icon).soft)}>
              {subjectStyle(s.key, s.color, s.icon).emoji} {l(s.name)} · {t('level')} {s.level.level}
            </span>
          ))}
        </div>
      )}

      <InstallCard />
      {!feature && !waiting.length && <BouslaSays mood="sleepy">{t('noAvailable')}</BouslaSays>}
    </div>
  );
}
