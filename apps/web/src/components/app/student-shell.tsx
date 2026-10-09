'use client';

import { BookOpenCheck, Castle, Home, Map, Swords, User, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Arzino } from '@/components/arzino';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import type { Gamification } from '@/lib/types';
import { Coins, LevelStat, StreakFlame, WeekStreak, XpStat } from '@/components/kid/stats';
import { Button } from '@/components/ui/button';
import { LanguageSwitch } from './locale';
import { FlagMark, Logo } from './logo';
import { NotificationsBell } from './notifications';
import { UserMenu } from './user-menu';
import { InviteListener } from '@/components/campus/invite-listener';

/** Each tab keeps its colorful icon (Duolingo-style): the color is the icon, the active state is the blue pill. */
const TABS: { href: string; icon: LucideIcon; key: string; color: string }[] = [
  { href: '/student', icon: Home, key: 'home', color: 'text-flag' },
  { href: '/student/map', icon: Map, key: 'map', color: 'text-cedar' },
  { href: '/student/missions', icon: Swords, key: 'missions', color: 'text-flame' },
  { href: '/student/campus', icon: Castle, key: 'campus', color: 'text-med' },
  { href: '/student/reviews', icon: BookOpenCheck, key: 'reviews', color: 'text-cedar-d dark:text-cedar' },
  { href: '/student/me', icon: User, key: 'me', color: 'text-med' },
];

/** Lesson-like screens run full-screen (no nav), like a Duolingo lesson: mission stepper, result, peer review. */
const FOCUS = /^\/student\/(missions|submissions|reviews)\/[^/]+/;

export function StudentShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('student.tabs');
  const path = usePathname();
  const { data: g } = useApi<Gamification>('/gamification/me');
  const { data: reviews } = useApi<{ status: string }[]>('/peer-reviews/assigned');
  const waiting = reviews?.filter((r) => r.status === 'ASSIGNED').length ?? 0;
  const active = (href: string) => (href === '/student' ? path === '/student' : path.startsWith(href));

  if (FOCUS.test(path)) {
    return (
      <div className="min-h-dvh bg-background">
        <main className="mx-auto w-full max-w-[720px] px-4 pb-10 pt-3 sm:px-6">{children}</main>
        <InviteListener />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[1400px] bg-background pb-24 min-[721px]:grid min-[721px]:grid-cols-[96px_minmax(0,1fr)] min-[721px]:grid-rows-[auto_1fr] min-[721px]:pb-0 min-[1180px]:grid-cols-[248px_minmax(0,1fr)_372px]">
      {/* Nav: bottom tab bar (phone) · icon rail (tablet) · labelled left nav (desktop). One element, so every tab-* test id stays unique. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[721px]:sticky min-[721px]:top-0 min-[721px]:row-span-2 min-[721px]:flex min-[721px]:h-dvh min-[721px]:flex-col min-[721px]:self-start min-[721px]:border-e-2 min-[721px]:border-t-0 min-[721px]:bg-background min-[721px]:px-3 min-[721px]:py-6 min-[721px]:backdrop-blur-none min-[1180px]:px-4"
        aria-label="Student navigation"
      >
        <div className="mb-7 hidden min-[721px]:flex min-[721px]:justify-center min-[1180px]:justify-start min-[1180px]:ps-3">
          <Logo href="/student" small className="hidden min-[1180px]:inline-flex" />
          <Link href="/student" className="min-[1180px]:hidden" aria-label="Tajriba home">
            <FlagMark className="h-7 w-[42px]" />
          </Link>
        </div>
        <ul className="grid grid-cols-6 gap-0.5 px-0.5 py-1 min-[721px]:flex min-[721px]:flex-col min-[721px]:gap-2 min-[721px]:p-0">
          {TABS.map(({ href, icon: Icon, key, color }) => {
            const on = active(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  title={t(key)}
                  className={cn(
                    'relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 text-[10px] font-black uppercase tracking-[0.01em] transition-colors',
                    'min-[721px]:h-14 min-[721px]:min-h-0 min-[721px]:flex-row min-[721px]:gap-4 min-[1180px]:justify-start min-[1180px]:px-4 min-[1180px]:text-[15px] min-[1180px]:tracking-[0.08em]',
                    on ? 'border-med/60 bg-med-soft text-med-ink dark:text-white' : 'border-transparent text-muted-foreground hover:bg-muted',
                  )}
                  data-testid={`tab-${key}`}
                >
                  <Icon className={cn('size-6 shrink-0 min-[721px]:size-7', color)} strokeWidth={2.4} fill="currentColor" fillOpacity={0.16} aria-hidden />
                  <span className="max-w-full truncate min-[721px]:sr-only min-[1180px]:not-sr-only">{t(key)}</span>
                  {key === 'reviews' && waiting > 0 && (
                    <span className="absolute end-1.5 top-1 flex size-5 items-center justify-center rounded-full bg-flag text-[11px] font-black text-white min-[721px]:end-1 min-[1180px]:static min-[1180px]:ms-auto min-[1180px]:size-6">
                      {waiting}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto hidden border-t-2 border-border pt-4 min-[1180px]:block">
          <LanguageSwitch className="w-full justify-center" />
        </div>
      </nav>

      {/* Stats: sticky top bar on phone/tablet, top of the right rail on desktop (display: contents below 1180px). */}
      <aside className="contents min-[1180px]:sticky min-[1180px]:top-0 min-[1180px]:col-start-3 min-[1180px]:row-span-2 min-[1180px]:row-start-1 min-[1180px]:block min-[1180px]:h-dvh min-[1180px]:self-start min-[1180px]:overflow-y-auto min-[1180px]:px-6 min-[1180px]:py-5">
        <header className="sticky top-0 z-30 border-b-2 border-border bg-background/95 backdrop-blur min-[721px]:col-start-2 min-[721px]:row-start-1 min-[1180px]:static min-[1180px]:border-0 min-[1180px]:bg-transparent min-[1180px]:backdrop-blur-none">
          <div className="mx-auto flex h-16 max-w-3xl items-center gap-1 px-3 min-[1180px]:h-auto min-[1180px]:px-0">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-0.5 min-[640px]:justify-start min-[640px]:gap-3 min-[1180px]:justify-between min-[1180px]:gap-1">
              {g ? (
                <>
                  <StreakFlame days={g.streak.current} bare />
                  <XpStat xp={g.xp} />
                  <LevelStat level={g.level.level} />
                  <Coins points={g.wallet} bare />
                </>
              ) : (
                <span className="h-10" />
              )}
            </div>
            <div className="hidden shrink-0 min-[640px]:block min-[1180px]:hidden">
              <LanguageSwitch />
            </div>
            <NotificationsBell className="size-10 shrink-0" />
            <UserMenu />
          </div>
        </header>
        <div className="hidden min-[1180px]:block">
          <Rail g={g} waiting={waiting} />
        </div>
      </aside>

      <main className="min-w-0 px-4 py-5 min-[721px]:col-start-2 min-[721px]:row-start-2 min-[721px]:px-8 min-[721px]:py-7 min-[1180px]:row-span-2 min-[1180px]:row-start-1 min-[1180px]:px-10">
        <div className="mx-auto w-full max-w-[680px]">{children}</div>
      </main>
      <InviteListener />
    </div>
  );
}

/** Desktop right rail: level, streak and reviews, each with its Arzino. */
function Rail({ g, waiting }: { g?: Gamification; waiting: number }) {
  const t = useTranslations('student');
  if (!g) return null;
  const pct = Math.round(g.level.progress * 100);
  return (
    <div className="mt-5 space-y-4">
      <div className="chunky rounded-[20px] p-4">
        <div className="flex items-center gap-3">
          <Arzino mood={g.streak.current > 0 ? 'streak-hug' : 'streak-small'} size={92} />
          <div className="min-w-0">
            <p className="eyebrow !text-flame-d dark:!text-flame">{t('rail.streak')}</p>
            <p className="font-display text-2xl font-black leading-tight">{t('streakDays', { days: g.streak.current })}</p>
            <p className="text-sm font-bold text-muted-foreground">{t('rail.streakSub')}</p>
          </div>
        </div>
        <WeekStreak activeDays={g.activeDays} className="mt-3" />
      </div>

      <div className="chunky rounded-[20px] p-4">
        <div className="flex items-center gap-3">
          <Arzino mood="cool" size={92} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow !text-med-ink dark:!text-med">{t('rail.level')}</p>
            <p className="font-display text-2xl font-black leading-tight">
              {t('level')} {g.level.level}
            </p>
            <p className="text-sm font-bold text-muted-foreground">{t('nextLevelAt', { xp: g.level.nextLevelXp })}</p>
          </div>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-lock" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="bar-gloss h-full rounded-full bg-med transition-[width] duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </div>

      {waiting > 0 ? (
        <div className="chunky rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <Arzino mood="clipboard" size={92} />
            <div className="min-w-0">
              <p className="eyebrow !text-cedar-ink dark:!text-cedar">{t('rail.reviews')}</p>
              <p className="font-display text-xl font-black leading-tight">{t('reviewsWaiting', { count: waiting })}</p>
            </div>
          </div>
          <Button asChild variant="kid" className="mt-3 w-full">
            <Link href="/student/reviews">{t('review')}</Link>
          </Button>
        </div>
      ) : (
        <div className="chunky rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <Arzino mood="lebanese-pride" size={92} />
            <div className="min-w-0">
              <p className="eyebrow">{t('rail.wallet')}</p>
              <p className="font-display text-xl font-black leading-tight">{t('walletPoints', { points: g.wallet })}</p>
              <p className="text-sm font-bold text-muted-foreground">{t('rail.walletSub')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
