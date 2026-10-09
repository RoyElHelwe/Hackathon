'use client';

import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { CopyButton } from './copy-button';
import { EYEBROW } from './tone';

/** The school code teachers use to join, with a copy button. Arzino shows some Lebanese pride. */
export function SchoolCodeCard({ code, className }: { code: string; className?: string }) {
  const t = useTranslations('director.code');
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div aria-hidden className="flag-stripe absolute inset-x-0 top-0 h-2 opacity-90" />
      <div className="flex h-full flex-col gap-3 p-5 pt-6">
        <div className="flex items-center gap-3">
          <Arzino mood="lebanese-pride" size={84} animate={false} className="-my-2 -ms-1" />
          <div className="min-w-0">
            <p className={cn(EYEBROW, 'text-flag-d dark:text-danger')}>{t('title')}</p>
            <p className="text-sm font-semibold leading-snug text-muted-foreground">{t('body')}</p>
          </div>
        </div>
        <p
          className="rounded-[16px] border-2 border-dashed border-border bg-muted px-4 py-3 text-center font-display text-[34px] font-black leading-none tracking-[0.14em]"
          dir="ltr"
          data-testid="school-code"
        >
          {code}
        </p>
        <CopyButton text={code} label={t('copy')} copiedLabel={t('copied')} className="mt-auto w-full" data-testid="copy-school-code" />
      </div>
    </Card>
  );
}
