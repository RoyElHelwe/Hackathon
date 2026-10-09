'use client';

import { ArrowRight, BookOpenCheck, Mic } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Arzino, ArzinoSays } from '@/components/arzino';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { BadgeCard } from '@/components/kid/celebrations';
import { Coins, LevelRing, StreakFlame, XpBar } from '@/components/kid/stats';
import { InstallCard } from '@/components/student/install-card';
import { MissionCard, missionHref } from '@/components/student/mission-card';
import { RewardCelebration } from '@/components/student/reward-celebration';
import { TopicGlyph } from '@/components/app/subject-icon';
import { subjectStyle } from '@/components/student/subject-style';
import { Button } from '@/components/ui/button';
import { useApi, useL, useMe } from '@/lib/hooks';
import type { MyExam } from '@/lib/campus/types';
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
  const exams = useApi<MyExam[]>('/exams/mine');
  const tcampus = useTranslations('campus');
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
  // an exam room that is open right now beats everything else on home
  const openExam = exams.data?.find((e) => e.examStatus === 'OPEN' && (e.status === 'NOT_STARTED' || e.status === 'IN_PROGRESS'));

  const fst = feature ? subjectStyle(feature.topic?.subject?.key, feature.topic?.subject?.color, feature.topic?.subject?.icon) : null;
  const firstName = me?.user.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      {unseenRewards && !celebrated && (
        <div className="relative">
          <RewardCelebration rewards={unseenRewards} onDone={() => setCelebrated(true)} />
        </div>
      )}

      {/* Hello: big Arzino + one line */}
      <section className="flex items-center gap-2 sm:gap-4">
        <Arzino mood={gm.streak.current >= 3 ? 'cheer' : 'welcome'} size={132} pop priority className="-ms-2 sm:hidden" />
        <Arzino mood={gm.streak.current >= 3 ? 'cheer' : 'welcome'} size={176} pop priority className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[32px] font-black leading-[1.05]" data-testid="greeting">
            {t('greeting', { name: firstName })}
          </h1>
          <p className="mt-1 text-[17px] font-bold text-muted-foreground">{t('greetingSub')}</p>
        </div>
      </section>

      {/* Level + streak + wallet (the right rail shows this on desktop) */}
      <div className="chunky flex items-center gap-4 rounded-[20px] p-4 min-[1180px]:hidden">
        <LevelRing level={gm.level.level} progress={gm.level.progress} />
        <div className="min-w-0 flex-1 space-y-3">
          <XpBar progress={gm.level.progress} xp={gm.xp} nextLevelXp={gm.level.nextLevelXp} />
          <div className="flex flex-wrap gap-2">
            <StreakFlame days={gm.streak.current} />
            <Coins points={gm.wallet} />
          </div>
        </div>
      </div>

      {openExam && (
        <div className="chunky flex flex-wrap items-center gap-3 rounded-[20px] border-med/50 p-4 shadow-[0_4px_0_0_var(--med)]" data-testid="home-exam">
          <Arzino mood="laser-focus" size={76} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow !text-med-ink dark:!text-med">
              <Mic className="me-1 inline size-3.5" />
              {tcampus('exams.title')}
            </p>
            <p className="truncate font-display text-lg font-black leading-tight">{openExam.title}</p>
            <p className="text-xs font-bold text-muted-foreground">
              {openExam.className} · {tcampus('exams.minutes', { n: openExam.durationMin })}
            </p>
          </div>
          <Button asChild variant="kidMint" size="sm" className="w-full sm:w-auto">
            <Link href={`/student/exams/${openExam.attemptId}`}>{tcampus('exams.enter')}</Link>
          </Button>
        </div>
      )}

      {/* The next mission: a subject-colored unit block, like the path's banner */}
      {feature && fst && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
          <Link href={missionHref(feature)} data-testid="continue-mission" className="group block">
            <div
              className="relative overflow-hidden rounded-[24px] p-5 pe-24 text-white transition-transform group-hover:-translate-y-0.5 group-active:translate-y-[3px] sm:pe-40"
              style={{ background: fst.hex, boxShadow: `0 6px 0 ${fst.hexD}` }}
            >
              <div className="pointer-events-none absolute -bottom-10 -start-6 text-[150px] leading-none opacity-[0.13]" aria-hidden>
                <TopicGlyph topicKey={feature.topic?.key} icon={feature.topic?.icon} />
              </div>
              <div className="pointer-events-none absolute -bottom-1 end-1 sm:end-3" aria-hidden>
                <Arzino mood={active ? 'determined' : 'reading'} size={96} className="sm:hidden" title="" />
                <Arzino mood={active ? 'determined' : 'reading'} size={150} className="hidden sm:inline-flex" title="" />
              </div>
              <p className="relative text-[12px] font-black uppercase tracking-[0.09em] text-white/85">
                {feature.topic?.subject ? `${l(feature.topic.subject.name)} · ` : ''}
                {active ? t('continueMission') : t('nextMission')}
              </p>
              <p className="relative mt-1 font-display text-[22px] font-black leading-tight sm:text-[24px]">{l(feature.title)}</p>
              <p className="relative mt-1 line-clamp-2 font-semibold text-white/90">{l(feature.story)}</p>
              <div className="relative mt-4 flex flex-wrap items-center gap-2">
                <span className="kid-press inline-flex h-12 items-center gap-2 rounded-[16px] bg-white px-5 font-display text-[15px] font-black uppercase tracking-[0.08em] [--press:rgba(0,0,0,0.18)]" style={{ color: fst.hexD }}>
                  {active ? t('resume') : t('go')} <ArrowRight className="rtl-flip size-5" />
                </span>
                <span className="rounded-[12px] bg-black/15 px-3 py-1.5 text-sm font-black">
                  ⚡ {t('xp', { xp: feature.xpReward })} · {tc('minutes', { n: feature.estimatedMin })}
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {toReview.length > 0 && (
        <Link href="/student/reviews" data-testid="reviews-waiting" className="block">
          <div className="chunky chunky-hover flex items-center gap-3 rounded-[20px] p-4">
            <Arzino mood="clipboard" size={84} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-black leading-tight">{t('reviewsWaiting', { count: toReview.length })}</p>
              <p className="text-sm font-bold text-muted-foreground">{t('reviewsWaitingBody')}</p>
            </div>
            <Button variant="kid" size="sm" tabIndex={-1} className="shrink-0">
              <BookOpenCheck className="!size-4" /> {t('review')}
            </Button>
          </div>
        </Link>
      )}

      {waiting.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Arzino mood="bored-waiting" size={56} />
            <h2 className="font-display text-xl font-black">{t('waitingResults')}</h2>
          </div>
          <div className="space-y-3">
            {waiting.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        </section>
      )}

      {badges.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-black">{t('latestBadges')}</h2>
            <Link href="/student/me" className="text-sm font-black uppercase tracking-[0.08em] text-med-ink dark:text-med">
              {t('seeAll')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {badges.map((b) => (
              <BadgeCard key={b.key} icon={b.icon} name={b.name} badgeKey={b.key} size="sm" />
            ))}
          </div>
        </section>
      )}

      {gm.subjects.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-black">{t('yourSubjects')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {gm.subjects.map((s) => {
              const ss = subjectStyle(s.key, s.color, s.icon);
              return (
                <Link key={s.key} href="/student/map" className="chunky chunky-hover flex items-center gap-3 rounded-[20px] p-3.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] text-2xl" style={{ background: ss.hex, boxShadow: `0 4px 0 ${ss.hexD}` }} aria-hidden>
                    {ss.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-black">{l(s.name)}</p>
                      <span className={cn('shrink-0 text-sm font-black', ss.text)}>
                        {t('level')} {s.level.level}
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-lock">
                      <div className="bar-gloss h-full rounded-full" style={{ width: `${Math.max(6, s.level.progress * 100)}%`, background: ss.hex }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <InstallCard />
      {!feature && !waiting.length && (
        <ArzinoSays mood="bored-waiting" size={110}>
          {t('noAvailable')}
        </ArzinoSays>
      )}
    </div>
  );
}
