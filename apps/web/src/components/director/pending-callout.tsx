'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { EYEBROW } from './tone';

export function PendingCallout({ count }: { count: number }) {
  const t = useTranslations('director.overview');
  if (!count) {
    return (
      <Card className="flex items-center gap-3 p-4" data-testid="pending-callout">
        <Arzino mood="correct" size={64} animate={false} />
        <p className="font-bold text-muted-foreground">{t('noPending')}</p>
      </Card>
    );
  }
  return (
    <Card className="flex h-full flex-col gap-3 p-5" data-testid="pending-callout">
      <div className="flex items-center gap-3">
        <Arzino mood="clipboard" size={84} animate={false} className="-my-2" />
        <div className="min-w-0">
          <p className={cn(EYEBROW, 'text-flag-d dark:text-danger')}>{t('needsAttention')}</p>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-[34px] font-black leading-none text-flag-d tabular-nums dark:text-danger" data-testid="pending-count">
              {count}
            </span>
            <span className="text-lg font-extrabold leading-tight">{t('pendingShort', { n: count })}</span>
          </p>
        </div>
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{t('pendingBody')}</p>
      <Button asChild variant="kidCoral" className="mt-auto w-full" data-testid="review-pending">
        <Link href="/director/members">
          {t('pendingCta')} <ArrowRight className="rtl-flip" />
        </Link>
      </Button>
    </Card>
  );
}
