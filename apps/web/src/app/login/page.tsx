'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { BouslaSays } from '@/components/bousla';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
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
  const params = useSearchParams();
  const next = params.get('next') ?? '';
  const error = params.get('error');
  const { data: cfg } = useApi<{ google: boolean; devLogin: boolean }>('/auth/config');
  const { data: users } = useApi<DevUser[]>(cfg?.devLogin ? '/auth/dev/users' : null);
  const q = next ? `&next=${encodeURIComponent(next)}` : '';

  return (
    <div className="min-h-dvh bg-background bg-dots">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Logo />
        <LanguageSwitch />
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16">
        <div className="mx-auto max-w-md pt-6 text-center">
          <BouslaSays mood="happy" size={88} className="justify-center">
            {t('title')}
          </BouslaSays>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
          {error && <p className="mt-4 rounded-[14px] bg-coral-soft p-3 font-semibold text-danger">{t.has(`errors.${error}`) ? t(`errors.${error}`) : tc('error')}</p>}
          <a
            href={`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="kid-press mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-border bg-card px-6 font-display text-lg font-bold [--press:var(--border)]"
            data-testid="google-signin"
          >
            <svg viewBox="0 0 48 48" className="size-6" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {t('google')}
          </a>
          {cfg && !cfg.google && <p className="mt-3 text-sm text-muted-foreground">{t('googleMissing')}</p>}
        </div>

        {cfg?.devLogin && users && (
          <section id="demo" className="mt-12">
            <h2 className="font-display text-2xl font-extrabold">{t('devTitle')}</h2>
            <p className="text-muted-foreground">{t('devSubtitle')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((u) => (
                <a key={u.handle} href={`/api/auth/dev?as=${u.handle}${q}`} data-testid={`dev-login-${u.handle}`}>
                  <Card className="flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5 hover:border-primary">
                    <Avatar name={u.name} src={u.avatarUrl} className="size-12" />
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{u.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r.role} variant={r.status === 'PENDING' ? 'sunny' : 'default'}>
                            {tc(`roles.${r.role}`)}
                            {r.status === 'PENDING' ? ' · ⏳' : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
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
