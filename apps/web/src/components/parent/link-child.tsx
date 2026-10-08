'use client';

import { ArrowRight, Info, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FamilyKeypad } from '@/components/app/family-keypad';
import { Bousla } from '@/components/bousla';
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
      <Card className="mx-auto max-w-md p-6 text-center sm:p-8" data-testid="link-success">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }} className="flex justify-center">
          <Bousla mood="cheering" size={130} />
        </motion.div>
        <h2 className="mt-4 font-display text-3xl font-extrabold">{t('successTitle', { name })}</h2>
        <p className="mt-2 text-muted-foreground">{t('successBody', { name, school: result.school.name })}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild size="pill" data-testid="see-child">
            <Link href={`/parent?child=${result.child.id}`}>
              {t('seeProgress', { name })} <ArrowRight className="rtl-flip" />
            </Link>
          </Button>
          <Button variant="ghost" onClick={reset}>
            <Plus /> {t('another')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md p-6 sm:p-8">
      <div className="mb-5 flex flex-col items-center text-center">
        <Bousla mood={error ? 'curious' : busy ? 'thinking' : 'happy'} size={88} />
        <p className="mt-3 flex items-start gap-2 rounded-[14px] bg-sky-soft px-3 py-2 text-start text-sm font-semibold">
          <Info className="mt-0.5 size-4 shrink-0 text-sky" /> {t('how')}
        </p>
      </div>
      <FamilyKeypad key={attempt} onComplete={submit} disabled={busy} error={error} />
      <div className="mt-5 min-h-12 text-center" aria-live="polite">
        {busy && <p className="font-bold text-muted-foreground">{t('linking')}</p>}
        {error && (
          <div className="space-y-3" role="alert" data-testid="link-error">
            <p className="font-semibold text-danger">{error}</p>
            <Button variant="outline" onClick={reset}>
              {t('tryAgain')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
