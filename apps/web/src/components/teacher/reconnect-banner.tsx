'use client';

import { PlugZap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';

/** Shown when Google Classroom sync fails (expired / revoked token). */
export function ReconnectBanner() {
  const t = useTranslations('teacher.reconnect');
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[20px] border-2 border-flag/40 bg-flag-soft p-4" role="alert" data-testid="reconnect-banner">
      <Arzino mood="oops" size={64} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-display text-lg font-black">
          <PlugZap className="size-5 text-flag" /> {t('title')}
        </p>
        <p className="text-sm font-semibold text-muted-foreground">{t('body')}</p>
      </div>
      <Button asChild variant="kidCoral" size="sm">
        <a href="/api/classroom/connect" data-testid="reconnect-classroom">
          {t('cta')}
        </a>
      </Button>
    </div>
  );
}
