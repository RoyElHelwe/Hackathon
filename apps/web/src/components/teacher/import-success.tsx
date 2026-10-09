'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Arzino } from '@/components/arzino';
import { fireConfetti } from '@/components/kid/celebrations';
import { Button } from '@/components/ui/button';
import type { ImportResult } from './types';

export function ImportSuccess({ results }: { results: ImportResult[] }) {
  const t = useTranslations('teacher.onboarding');
  useEffect(() => {
    fireConfetti(true);
  }, []);
  const first = results[0];
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <Arzino mood="celebrate" size={190} pop />
      <h2 className="mt-3 font-display text-[34px] font-black leading-tight">{t('successTitle')}</h2>
      <div className="mt-4 w-full max-w-md space-y-2" data-testid="import-success">
        {results.map((r) => (
          <p key={r.classId} className="rounded-[16px] border-2 border-cedar/30 bg-cedar-soft px-4 py-3 text-base font-extrabold text-cedar-ink dark:text-white">
            {t('importedLine', { count: r.total, name: r.name })}
          </p>
        ))}
      </div>
      <p className="mt-3 max-w-md text-sm font-semibold text-muted-foreground">{t('successBody')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {first && (
          <Button asChild size="lg" variant="kidMint">
            <Link href={`/teacher/classes/${first.classId}`} data-testid="open-imported-class">
              {t('openClass', { name: first.name })} <ArrowRight className="rtl-flip" />
            </Link>
          </Button>
        )}
        <Button asChild size="lg" variant="kidGhost">
          <Link href="/teacher">{t('allClasses')}</Link>
        </Button>
      </div>
    </div>
  );
}
