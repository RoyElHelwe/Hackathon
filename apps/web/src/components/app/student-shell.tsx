'use client';

import { BookOpenCheck, Home, Map, Swords, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import type { Gamification } from '@/lib/types';
import { Coins, StreakFlame } from '@/components/kid/stats';
import { LanguageSwitch } from './locale';
import { Logo } from './logo';
import { NotificationsBell } from './notifications';
import { UserMenu } from './user-menu';

const TABS = [
  { href: '/student', icon: Home, key: 'home' },
  { href: '/student/map', icon: Map, key: 'map' },
  { href: '/student/missions', icon: Swords, key: 'missions' },
  { href: '/student/reviews', icon: BookOpenCheck, key: 'reviews' },
  { href: '/student/me', icon: User, key: 'me' },
] as const;

export function StudentShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('student.tabs');
  const path = usePathname();
  const { data: g } = useApi<Gamification>('/gamification/me');
  const { data: reviews } = useApi<{ status: string }[]>('/peer-reviews/assigned');
  const waiting = reviews?.filter((r) => r.status === 'ASSIGNED').length ?? 0;
  const active = (href: string) => (href === '/student' ? path === '/student' : path.startsWith(href));

  return (
    <div className="min-h-dvh bg-background bg-dots pb-28">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4">
          <Logo href="/student" small />
          <div className="flex items-center gap-2">
            {g && <StreakFlame days={g.streak.current} compact />}
            {g && <Coins points={g.wallet} compact />}
            <LanguageSwitch className="hidden sm:inline-flex" />
            <NotificationsBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Student navigation">
        <ul className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map(({ href, icon: Icon, key }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn('relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors', active(href) ? 'text-primary' : 'text-muted-foreground')}
                data-testid={`tab-${key}`}
              >
                <span className={cn('flex h-9 w-14 items-center justify-center rounded-full transition-colors', active(href) && 'bg-violet-soft')}>
                  <Icon className="size-6" />
                </span>
                {t(key)}
                {key === 'reviews' && waiting > 0 && (
                  <span className="absolute end-[22%] top-1.5 flex size-5 items-center justify-center rounded-full bg-coral text-[11px] font-extrabold text-white">{waiting}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
