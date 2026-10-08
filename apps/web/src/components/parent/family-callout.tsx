'use client';

import { ArrowRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/** Shown on the dashboard when a family mission waits for the parent's confirmation. */
export function FamilyCallout({ childName }: { childName: string }) {
  const t = useTranslations('parent.familyCallout');
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[20px] border-2 border-coral/40 bg-coral-soft p-4" data-testid="family-callout">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-coral text-white">
        <Heart className="size-6 fill-current" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold leading-tight">{t('title', { name: childName })}</p>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <Button asChild variant="kidCoral" size="default" className="w-full sm:w-auto">
        <Link href="/parent/family">
          {t('cta')} <ArrowRight className="rtl-flip" />
        </Link>
      </Button>
    </div>
  );
}
