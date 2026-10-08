'use client';

import { PlugZap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/** Shown when Google Classroom sync fails (expired / revoked token). */
export function ReconnectBanner() {
  const t = useTranslations('teacher.reconnect');
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[20px] border border-coral/40 bg-coral-soft p-4" role="alert" data-testid="reconnect-banner">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-card text-danger">
        <PlugZap className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      <Button asChild variant="default" size="sm">
        <a href="/api/classroom/connect" data-testid="reconnect-classroom">
          {t('cta')}
        </a>
      </Button>
    </div>
  );
}
