'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Arzino } from '@/components/arzino';
import { GoogleG } from '@/components/app/google-g';
import { LanguageSwitch } from '@/components/app/locale';
import { Logo } from '@/components/app/logo';
import { roleStyle } from '@/components/app/role-style';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useMe } from '@/lib/hooks';

export default function InvitePage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useApi<{ role: string; school: { name: string }; studentName: string | null; expired: boolean; used: boolean }>(`/invites/${token}`);
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error instanceof ApiError ? error.message : undefined} className="min-h-dvh" />;

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/invites/${token}/accept`, { method: 'POST' });
      const m = await api<{ home: string }>('/me');
      window.location.href = m.home;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  const dead = data.expired || data.used;
  const rs = roleStyle(data.role);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Logo small />
        <LanguageSwitch compact />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
        <div className={cn('relative flex w-full items-end justify-center overflow-hidden rounded-[28px] pt-6', dead ? 'bg-muted' : rs.soft)}>
          <div className="absolute -bottom-20 size-64 rounded-full bg-white/40 dark:bg-white/5" aria-hidden />
          <Arzino mood={dead ? 'sad' : 'surprise'} size={200} pop priority className="relative" />
        </div>
        {!dead && <span className={cn('mt-5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider', rs.solid)}>{tc(`roles.${data.role}`)}</span>}
        <h1 className="mt-3 font-display text-[30px] leading-tight sm:text-[34px]">{t('inviteTitle')}</h1>
        <p className="mt-2 text-lg">{t('inviteBody', { school: data.school.name, role: tc(`roles.${data.role}`) })}</p>
        {data.studentName && <p className="mt-1 text-muted-foreground">{t('inviteChild', { name: data.studentName })}</p>}
        <div className="mt-6 w-full">
          {dead ? (
            <p className="rounded-[16px] border-2 border-flag/30 bg-flag-soft p-3 font-bold text-flag-d dark:text-danger">{t('inviteExpired')}</p>
          ) : me ? (
            <Button variant="kid" size="lg" loading={busy} onClick={accept} className="w-full">
              {t('acceptInvite')}
            </Button>
          ) : (
            <a
              href={`/api/auth/google?next=/invite/${token}`}
              className="kid-press inline-flex h-14 w-full items-center justify-center gap-3 rounded-[16px] border-2 border-border bg-card px-6 text-lg font-extrabold [--press:var(--border)] hover:bg-muted"
            >
              <GoogleG /> {t('signInToAccept')}
            </a>
          )}
        </div>
        {err && <p className="mt-4 w-full rounded-[16px] border-2 border-flag/30 bg-flag-soft p-3 font-bold text-flag-d dark:text-danger">{err}</p>}
      </main>
    </div>
  );
}
