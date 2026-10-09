'use client';

import type { Role } from '@tajriba/shared';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';
import { LanguageSwitch } from './locale';
import { FlagMark, Logo } from './logo';
import { NotificationsBell } from './notifications';
import { UserMenu } from './user-menu';

/** Icon color of a nav item. Omitted → picked from a fixed cycle so every icon is colorful. */
export type NavTone = 'cedar' | 'med' | 'flag' | 'flame' | 'ink';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  tone?: NavTone;
}

const ICON_TONE: Record<NavTone, string> = {
  cedar: 'text-cedar',
  med: 'text-med',
  flag: 'text-flag',
  flame: 'text-flame',
  ink: 'text-foreground',
};
const CYCLE: NavTone[] = ['flag', 'cedar', 'med', 'flame', 'cedar', 'ink', 'med'];

/** Role accent: Teacher blue · Director/School red · Parent flame. */
type RoleTone = 'med' | 'flag' | 'flame';
const ROLE: Record<RoleTone, { active: string; dot: string; mood: ArzinoMood }> = {
  med: { active: 'border-med/45 bg-med-soft text-med-ink dark:text-white', dot: 'bg-med', mood: 'teaching' },
  flag: { active: 'border-flag/45 bg-flag-soft text-flag-d dark:text-white', dot: 'bg-flag', mood: 'clipboard' },
  flame: { active: 'border-flame/50 bg-flame-soft text-flame-d dark:text-white', dot: 'bg-flame', mood: 'warm' },
};

function roleTone(path: string, role: Role | undefined): RoleTone {
  if (path.startsWith('/director')) return 'flag';
  if (path.startsWith('/parent')) return 'flame';
  if (path.startsWith('/teacher')) return 'med';
  if (role === 'DIRECTOR' || role === 'ADMIN') return 'flag';
  if (role === 'PARENT') return 'flame';
  return 'med';
}

/**
 * Calm, data-dense layout for teachers, parents and directors.
 * ≥1180px: 248px left nav with labels · 721–1179px: 96px icon rail · ≤720px: top bar + scrollable tabs.
 */
export function AdultShell({ nav, children, home }: { nav: NavItem[]; children: React.ReactNode; home: string }) {
  const path = usePathname();
  const t = useTranslations('common');
  const { data: me } = useMe();
  const tone = ROLE[roleTone(path, me?.active?.role)];
  const isActive = (n: NavItem) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/'));
  const iconTone = (n: NavItem, i: number) => ICON_TONE[n.tone ?? CYCLE[i % CYCLE.length]];

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-24 flex-col items-center border-e-2 border-border bg-card py-6 min-[721px]:flex min-[1180px]:w-[248px] min-[1180px]:items-stretch min-[1180px]:px-5">
        <div className="min-[1180px]:ps-2">
          <span className="min-[1180px]:hidden">
            <Link href={home} aria-label="Tajriba home" className="inline-flex">
              <FlagMark className="h-7 w-[42px]" />
            </Link>
          </span>
          <span className="hidden min-[1180px]:inline-flex">
            <Logo href={home} />
          </span>
        </div>
        <nav className="mt-8 flex w-full flex-col items-center gap-2 px-3 min-[1180px]:items-stretch min-[1180px]:px-0" aria-label="Main">
          {nav.map((n, i) => {
            const active = isActive(n);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex size-14 items-center justify-center rounded-[16px] border-2 font-display text-[15px] font-black uppercase tracking-[0.08em] transition-colors min-[1180px]:h-[52px] min-[1180px]:w-full min-[1180px]:justify-start min-[1180px]:gap-4 min-[1180px]:px-4',
                  active ? tone.active : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                data-testid={`nav-${n.href.split('/').pop()}`}
              >
                <n.icon className={cn('size-6 shrink-0', iconTone(n, i))} strokeWidth={2.4} aria-hidden />
                <span className="sr-only min-[1180px]:not-sr-only min-[1180px]:flex-1 min-[1180px]:truncate">{n.label}</span>
                {!!n.badge && (
                  <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-flag px-1.5 text-[11px] font-black tracking-normal text-white min-[1180px]:static">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto w-full px-3 min-[1180px]:px-0">
          <div className="border-t-2 border-border pt-4">
            <div className="flex flex-col items-center gap-2 min-[1180px]:flex-row min-[1180px]:gap-3">
              <Arzino mood={tone.mood} size={60} animate={false} />
              <div className="hidden min-w-0 min-[1180px]:block">
                {me?.active && (
                  <p className="eyebrow flex items-center gap-1.5">
                    <span className={cn('size-2 rounded-full', tone.dot)} aria-hidden />
                    {t(`roles.${me.active.role}`)}
                  </p>
                )}
                <p className="mt-0.5 line-clamp-2 text-sm font-extrabold leading-tight">{me?.active?.schoolName}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-[721px]:ps-24 min-[1180px]:ps-[248px]">
        <header className="sticky top-0 z-20 border-b-2 border-border bg-background/90 backdrop-blur min-[721px]:border-b-0">
          <div className="flex h-16 items-center justify-between gap-3 px-4 min-[721px]:h-[72px] min-[721px]:px-8">
            <div className="min-[721px]:hidden">
              <Logo href={home} small />
            </div>
            <div className="hidden min-w-0 items-center gap-2 rounded-[14px] border-2 border-border bg-card px-3 py-1.5 text-sm font-extrabold min-[721px]:flex">
              <span className={cn('size-2.5 shrink-0 rounded-full', tone.dot)} aria-hidden />
              <span className="truncate">{me?.active?.schoolName}</span>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] min-[721px]:hidden" aria-label="Main">
            {nav.map((n, i) => {
              const active = isActive(n);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-11 shrink-0 items-center gap-2 rounded-[14px] border-2 px-3.5 font-display text-[13px] font-black uppercase tracking-[0.06em]',
                    active ? tone.active : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  <n.icon className={cn('size-[18px]', iconTone(n, i))} strokeWidth={2.4} aria-hidden />
                  {n.label}
                  {!!n.badge && <span className="rounded-full bg-flag px-1.5 text-[11px] font-black tracking-normal text-white">{n.badge}</span>}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-4 min-[721px]:px-8 min-[721px]:pt-2">{children}</main>
      </div>
    </div>
  );
}

/** Page title block: optional Arzino pose, eyebrow, 30–34px black title, one line under it, actions on the end side. */
export function PageHeader({
  title,
  subtitle,
  actions,
  mood,
  eyebrow,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  mood?: ArzinoMood;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4 md:gap-5">
        {mood && (
          <>
            <Arzino mood={mood} size={108} className="-my-3 hidden sm:inline-flex" />
            <Arzino mood={mood} size={68} className="-my-2 sm:hidden" />
          </>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="font-display text-[28px] font-black leading-[1.1] tracking-tight sm:text-[32px] lg:text-[34px]">{title}</h1>
          {subtitle && <div className="mt-1.5 text-[15px] font-semibold text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
