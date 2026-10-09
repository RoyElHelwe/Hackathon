'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';

/** Shown on the dashboard when a family mission waits for the parent's confirmation. */
export function FamilyCallout({ childName }: { childName: string }) {
  const t = useTranslations('parent.familyCallout');
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[20px] border-2 border-flame/50 bg-flame-soft p-4 shadow-[0_4px_0_color-mix(in_oklab,var(--flame)_45%,transparent)]"
      data-testid="family-callout"
    >
      <Arzino mood="streak-hug" size={88} className="-my-3 shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-xl font-black leading-tight">{t('title', { name: childName })}</p>
        <p className="text-sm font-semibold text-muted-foreground">{t('body')}</p>
      </div>
      <Button asChild variant="kid" className="w-full sm:w-auto">
        <Link href="/parent/family">
          {t('cta')} <ArrowRight className="rtl-flip" />
        </Link>
      </Button>
    </div>
  );
}
