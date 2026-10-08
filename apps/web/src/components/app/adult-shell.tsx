'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/hooks';
import { LanguageSwitch } from './locale';
import { Logo } from './logo';
import { NotificationsBell } from './notifications';
import { UserMenu } from './user-menu';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
}

/** Calm, data-dense layout for teachers, parents and directors. Sidebar on desktop, top tabs on mobile. */
export function AdultShell({ nav, children, home }: { nav: NavItem[]; children: React.ReactNode; home: string }) {
  const path = usePathname();
  const { data: me } = useMe();
  const isActive = (n: NavItem) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/'));

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-border bg-card px-4 py-5 lg:flex">
        <Logo href={home} />
        <p className="mt-2 truncate ps-1 text-xs font-semibold text-muted-foreground">{me?.active?.schoolName}</p>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn('flex h-12 items-center gap-3 rounded-[14px] px-3 font-bold transition-colors', isActive(n) ? 'bg-violet-soft text-primary dark:text-white' : 'text-muted-foreground hover:bg-muted')}
              data-testid={`nav-${n.href.split('/').pop()}`}
            >
              <n.icon className="size-5" />
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="rounded-full bg-coral px-2 text-xs font-extrabold text-white">{n.badge}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
            <div className="lg:hidden">
              <Logo href={home} small />
            </div>
            <div className="hidden text-sm font-semibold text-muted-foreground lg:block">{me?.active?.schoolName}</div>
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <NotificationsBell />
              <UserMenu />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn('flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold', isActive(n) ? 'bg-violet-soft text-primary dark:text-white' : 'text-muted-foreground')}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
