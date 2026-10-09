'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Arzino } from '@/components/arzino';
import { GoogleG } from '@/components/app/google-g';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { roleStyle } from '@/components/app/role-style';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';

interface DevUser {
  handle: string;
  name: string;
  avatarUrl: string | null;
  roles: { role: string; status: string; school: string }[];
}

function LoginInner() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const next = params.get('next') ?? '';
  const error = params.get('error');
  const { data: cfg } = useApi<{ google: boolean; devLogin: boolean }>('/auth/config');
  const { data: users } = useApi<DevUser[]>(cfg?.devLogin ? '/auth/dev/users' : null);
  const q = next ? `&next=${encodeURIComponent(next)}` : '';

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="inline-flex items-center gap-1 text-[15px] font-black uppercase tracking-[0.08em] text-med-ink hover:text-med dark:text-med">
          <ChevronLeft className="rtl-flip size-5" /> {t('home')}
        </Link>
        <Logo small className="max-sm:hidden" />
        <LanguageSwitch compact />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mx-auto flex max-w-md flex-col items-center pt-2 text-center sm:pt-6">
          <Arzino mood="welcome" size={200} pop priority className="max-sm:size-[160px]!" />
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="w-full">
            <p className="mt-2 font-display text-lg text-cedar">{t('loginSays')}</p>
            <h1 className="mt-1 font-display text-[30px] leading-tight sm:text-[34px]">{t('title')}</h1>
            <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
            {error && (
              <p className="mt-4 rounded-[16px] border-2 border-flag/30 bg-flag-soft p-3 font-bold text-flag-d dark:text-danger" role="alert">
                {t.has(`errors.${error}`) ? t(`errors.${error}`) : tc('error')}
              </p>
            )}
            <a
              href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="kid-press mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[16px] border-2 border-border bg-card px-6 text-lg font-extrabold [--press:var(--border)] hover:bg-muted"
              data-testid="google-signin"
            >
              <GoogleG />
              {t('google')}
            </a>
            {cfg && !cfg.google && <p className="mt-3 text-sm font-semibold text-muted-foreground">{t('googleMissing')}</p>}
          </motion.div>
        </div>

        {cfg?.devLogin && users && (
          <section id="demo" className="mx-auto mt-12 max-w-4xl scroll-mt-6">
            <div className="flex items-center gap-3">
              <span className="h-0.5 flex-1 bg-border" />
              <h2 className="eyebrow">{t('devTitle')}</h2>
              <span className="h-0.5 flex-1 bg-border" />
            </div>
            <p className="mt-2 text-center text-sm text-muted-foreground">{t('devSubtitle')}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((u, i) => {
                const main = roleStyle(u.roles[0]?.role ?? 'STUDENT');
                return (
                  <motion.a
                    key={u.handle}
                    href={`/api/auth/dev?as=${u.handle}${q}`}
                    data-testid={`dev-login-${u.handle}`}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="chunky chunky-hover group flex items-center gap-3 rounded-[18px] p-3.5"
                  >
                    <Avatar name={u.name} src={u.avatarUrl} className={cn('size-12 text-lg', main.solid)} />
                    <div className="min-w-0 flex-1 text-start">
                      <p className="truncate font-extrabold">{u.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.roles.map((r) => {
                          const s = roleStyle(r.role);
                          const pending = r.status === 'PENDING';
                          return (
                            <span
                              key={r.role}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wider',
                                pending ? 'border-2 border-dashed border-lock-d text-muted-foreground' : s.solid,
                              )}
                            >
                              {tc(`roles.${r.role}`)}
                              {pending ? ' · ⏳' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <ChevronRight className="rtl-flip size-5 shrink-0 text-lock-d transition-colors group-hover:text-cedar" />
                  </motion.a>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs font-bold text-muted-foreground">{t('devFoot')}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
