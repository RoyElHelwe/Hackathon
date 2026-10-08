'use client';

import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { CopyButton } from './copy-button';

/** The school code teachers use to join, with a copy button. */
export function SchoolCodeCard({ code, className }: { code: string; className?: string }) {
  const t = useTranslations('director.code');
  return (
    <Card className={className}>
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-[12px] bg-sunny-soft text-warning">
            <KeyRound className="size-5" />
          </span>
          <h3 className="text-lg font-extrabold">{t('title')}</h3>
        </div>
        <p className="font-display text-4xl font-extrabold tracking-[0.12em] text-primary dark:text-white" dir="ltr" data-testid="school-code">
          {code}
        </p>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
        <CopyButton text={code} label={t('copy')} copiedLabel={t('copied')} size="sm" className="mt-auto self-start" data-testid="copy-school-code" />
      </div>
    </Card>
  );
}
