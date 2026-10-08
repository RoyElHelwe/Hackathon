'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Bousla } from '@/components/bousla';
import { Logo } from '@/components/app/logo';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
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
  if (error || !data) return <ErrorState message={error instanceof ApiError ? error.message : undefined} />;

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <Bousla mood="cheering" size={140} />
      <h1 className="font-display text-3xl font-extrabold">{t('inviteTitle')}</h1>
      <p className="text-lg">{t('inviteBody', { school: data.school.name, role: tc(`roles.${data.role}`) })}</p>
      {data.studentName && <p className="text-muted-foreground">{t('inviteChild', { name: data.studentName })}</p>}
      {data.expired || data.used ? (
        <p className="rounded-[14px] bg-coral-soft p-3 font-semibold text-danger">{t('inviteExpired')}</p>
      ) : me ? (
        <Button variant="kid" size="pill" loading={busy} onClick={accept} className="w-full">
          {t('acceptInvite')}
        </Button>
      ) : (
        <Button asChild variant="kid" size="pill" className="w-full">
          <a href={`/api/auth/google?next=/invite/${token}`}>{t('signInToAccept')}</a>
        </Button>
      )}
      {err && <p className="rounded-[14px] bg-coral-soft p-3 font-semibold text-danger">{err}</p>}
    </main>
  );
}
