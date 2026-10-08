'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Bousla } from '@/components/bousla';
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
    <div className="flex flex-col items-center py-6 text-center">
      <Bousla mood="cheering" size={140} />
      <h2 className="mt-4 font-display text-3xl font-extrabold">{t('successTitle')}</h2>
      <div className="mt-3 space-y-1" data-testid="import-success">
        {results.map((r) => (
          <p key={r.classId} className="text-lg font-semibold">
            {t('importedLine', { count: r.total, name: r.name })}
          </p>
        ))}
      </div>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('successBody')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {first && (
          <Button asChild size="lg">
            <Link href={`/teacher/classes/${first.classId}`} data-testid="open-imported-class">
              {t('openClass', { name: first.name })} <ArrowRight className="rtl-flip" />
            </Link>
          </Button>
        )}
        <Button asChild size="lg" variant="outline">
          <Link href="/teacher">{t('allClasses')}</Link>
        </Button>
      </div>
    </div>
  );
}
