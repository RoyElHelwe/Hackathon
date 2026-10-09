'use client';

import { ArrowRight, Info, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FamilyKeypad } from '@/components/app/family-keypad';
import { Arzino } from '@/components/arzino';
import { fireConfetti } from '@/components/kid/celebrations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { useInvalidate } from '@/lib/hooks';
import { firstName } from './types';

interface LinkResult {
  child: { id: string; name: string; avatarUrl: string | null };
  school: { id: string; name: string };
}

const KNOWN_REASONS = ['not_found', 'expired', 'used'] as const;
type Reason = (typeof KNOWN_REASONS)[number];

/** Parent enters the child's 6-digit family code. */
export function LinkChild() {
  const t = useTranslations('parent.link');
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const submit = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<LinkResult>('/families/link', { body: { code } });
      setResult(r);
      fireConfetti(true);
      void invalidate('/me');
    } catch (e) {
      const reason = e instanceof ApiError ? e.data.reason : undefined;
      if (typeof reason === 'string' && (KNOWN_REASONS as readonly string[]).includes(reason)) setError(t(`errors.${reason as Reason}`));
      else setError(e instanceof ApiError && e.status < 500 ? e.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
    setAttempt((a) => a + 1);
  };

  if (result) {
    const name = firstName(result.child.name);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center text-center" data-testid="link-success">
        <Arzino mood="celebrate" size={200} pop priority />
        <h1 className="mt-2 text-[30px] font-black leading-tight">{t('successTitle', { name })}</h1>
        <p className="mt-2 font-semibold text-muted-foreground">{t('successBody', { name, school: result.school.name })}</p>
        <div className="mt-6 flex w-full flex-col gap-3">
          <Button asChild variant="kid" size="pill" data-testid="see-child">
            <Link href={`/parent?child=${result.child.id}`}>
              {t('seeProgress', { name })} <ArrowRight className="rtl-flip" />
            </Link>
          </Button>
          <Button variant="kidGhost" onClick={reset}>
            <Plus /> {t('another')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center text-center">
        <Arzino mood={error ? 'oops' : busy ? 'thinking' : 'welcome'} size={170} pop priority />
        <h1 className="mt-1 text-[30px] font-black leading-tight">{t('title')}</h1>
        <p className="mt-1 font-semibold text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Card className="mt-5 p-5 sm:p-7">
        <FamilyKeypad key={attempt} onComplete={submit} disabled={busy} error={error} />
        <div className="mt-4 min-h-12 text-center" aria-live="polite">
          {busy && <p className="font-black text-muted-foreground">{t('linking')}</p>}
          {error && (
            <div className="space-y-3" role="alert" data-testid="link-error">
              <p className="font-bold text-flag-d dark:text-danger">{error}</p>
              <Button variant="kidGhost" onClick={reset}>
                {t('tryAgain')}
              </Button>
            </div>
          )}
        </div>
      </Card>
      <p className="mt-4 flex items-start gap-2 rounded-[16px] border-2 border-med/25 bg-med-soft px-4 py-3 text-start text-sm font-bold text-med-ink dark:text-white">
        <Info className="mt-0.5 size-4 shrink-0" /> {t('how')}
      </p>
    </div>
  );
}
