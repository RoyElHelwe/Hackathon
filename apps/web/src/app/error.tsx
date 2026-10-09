'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center" role="alert">
      <div className="flex w-full max-w-sm items-end justify-center rounded-[28px] bg-flag-soft pt-6">
        <Arzino mood="oops" size={220} pop priority />
      </div>
      <h1 className="mt-6 max-w-md font-display text-[30px] leading-tight">{t('error')}</h1>
      <Button variant="kid" size="lg" onClick={reset} className="mt-7">
        <RefreshCw /> {t('retry')}
      </Button>
    </main>
  );
}
