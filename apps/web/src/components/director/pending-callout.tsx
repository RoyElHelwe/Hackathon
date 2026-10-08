'use client';

import { ArrowRight, CheckCircle2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function PendingCallout({ count }: { count: number }) {
  const t = useTranslations('director.overview');
  if (!count) {
    return (
      <Card className="flex items-center gap-3 p-5" data-testid="pending-callout">
        <CheckCircle2 className="size-6 shrink-0 text-success" />
        <p className="font-semibold text-muted-foreground">{t('noPending')}</p>
      </Card>
    );
  }
  return (
    <Card className="flex h-full flex-col gap-3 border-2 border-sunny/70 bg-sunny-soft p-5" data-testid="pending-callout">
      <div className="flex items-center gap-3">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-sunny text-ink">
          <UserPlus className="size-5" />
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-coral text-[11px] font-extrabold text-white" data-testid="pending-count">
            {count}
          </span>
        </span>
        <h3 className="text-lg font-extrabold leading-tight">{t('pendingTitle', { n: count })}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{t('pendingBody')}</p>
      <Button asChild size="sm" className="mt-auto self-start" data-testid="review-pending">
        <Link href="/director/members">
          {t('pendingCta')} <ArrowRight className="rtl-flip" />
        </Link>
      </Button>
    </Card>
  );
}
