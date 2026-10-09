'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Heart, RefreshCw, Sprout } from 'lucide-react';
import { motion } from 'motion/react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState, Thinking } from '@/components/app/states';
import { Arzino } from '@/components/arzino';
import { EYEBROW } from '@/components/director/tone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';
import type { WeeklySummary as Summary } from './types';

/** "This week" — AI-written summary in the parent's own language (cached per week). */
export function WeeklySummary({ studentId }: { studentId: string }) {
  const t = useTranslations('parent.summary');
  const locale = useLocale();
  // the language is part of the URL so switching it fetches (or writes) that language's summary instead of the cached one
  const path = `/parents/summary/${studentId}?lang=${locale}`;
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useApi<Summary>(path, { staleTime: 5 * 60_000, retry: 1 });
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const regenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const fresh = await api<Summary>(`/parents/summary/${studentId}/generate?lang=${locale}`, { method: 'POST' });
      qc.setQueryData([path], fresh);
    } catch (e) {
      setRegenError(e instanceof ApiError ? e.message : t('error'));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card className="overflow-hidden" data-testid="weekly-summary">
      <div className="flex items-center gap-3 p-5 pb-3 sm:gap-4">
        <Arzino mood="warm" size={96} className="-my-3 shrink-0" />
        <div className="min-w-0 flex-1">
          {data && (
            <p className={cn(EYEBROW, 'text-flame-d dark:text-warning')}>
              <WeekOf iso={data.weekStart} />
            </p>
          )}
          <h2 className="mt-0.5 text-2xl font-black leading-tight">{t('title')}</h2>
          <p className="text-sm font-semibold text-muted-foreground">{t('subtitle')}</p>
        </div>
        {data && (
          <Button variant="kidGhost" size="sm" onClick={regenerate} loading={regenerating} aria-label={t('regenerate')} data-testid="regenerate-summary">
            {!regenerating && <RefreshCw />}
            <span className="hidden sm:inline">{t('regenerate')}</span>
          </Button>
        )}
      </div>

      <div className="p-5 pt-3">
        {isLoading || regenerating ? (
          <Thinking label={t('thinking')} className="py-8" />
        ) : error ? (
          <ErrorState message={error instanceof ApiError ? error.message : t('error')} onRetry={() => refetch()} className="py-6" />
        ) : data ? (
          <SummaryBody summary={data} />
        ) : null}
        {regenError && (
          <p className="mt-3 rounded-[12px] bg-flag-soft px-3 py-2 text-sm font-bold text-flag-d dark:text-danger" role="alert">
            {regenError}
          </p>
        )}
      </div>
    </Card>
  );
}

function WeekOf({ iso }: { iso: string }) {
  const t = useTranslations('parent.summary');
  const format = useFormatter();
  return <>{t('weekOf', { date: format.dateTime(new Date(iso), { day: 'numeric', month: 'long', timeZone: 'UTC' }) })}</>;
}

function SummaryBody({ summary }: { summary: Summary }) {
  const t = useTranslations('parent.summary');
  const c = summary.content;
  // The summary is written in the parent's language, which may differ from the UI language.
  const dir = summary.locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <div className="space-y-4">
      <section>
        <h3 className={cn(EYEBROW, 'mb-2 text-cedar-ink dark:text-success')}>{t('highlights')}</h3>
        <ul className="space-y-2.5" dir={dir} lang={summary.locale}>
          {c.highlights.map((h, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 rounded-[14px] bg-cedar-soft px-3 py-2.5 text-[17px] font-semibold leading-relaxed"
              data-testid="summary-highlight"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-cedar text-white shadow-[0_2px_0_var(--cedar-d)]">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span>{h}</span>
            </motion.li>
          ))}
        </ul>
      </section>

      <section className="rounded-[16px] border-2 border-med/25 bg-med-soft p-4">
        <h3 className="mb-1.5 flex items-center gap-2 font-black text-med-ink dark:text-ring">
          <Sprout className="size-5" /> {t('struggles')}
        </h3>
        {c.struggles.length ? (
          <ul className="list-disc space-y-1 ps-5 font-semibold leading-relaxed marker:text-med" dir={dir} lang={summary.locale} data-testid="summary-struggles">
            {c.struggles.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="font-semibold text-muted-foreground">{t('noStruggles')}</p>
        )}
      </section>

      <section
        className="relative rounded-[18px] border-2 border-flame/50 bg-flame-soft p-4 pe-4 shadow-[0_4px_0_color-mix(in_oklab,var(--flame)_45%,transparent)]"
        data-testid="how-to-help"
      >
        <h3 className="mb-1.5 flex items-center gap-2 font-black text-flame-d dark:text-warning">
          <span className="flex size-8 items-center justify-center rounded-full bg-flame text-white shadow-[0_2px_0_var(--flame-d)]">
            <Clock className="size-4" strokeWidth={3} />
          </span>
          {t('howToHelp')}
        </h3>
        <p className="text-[17px] font-semibold leading-relaxed" dir={dir} lang={summary.locale}>
          {c.howToHelp}
        </p>
      </section>

      {c.suggestedFamilyMission && (
        <section className="rounded-[16px] border-2 border-dashed border-border p-4" data-testid="suggested-family-mission">
          <h3 className="mb-1.5 flex items-center gap-2 font-black">
            <Heart className="size-5 fill-flag text-flag" /> {t('familyMission')}
          </h3>
          <p className="font-semibold leading-relaxed" dir={dir} lang={summary.locale}>
            {c.suggestedFamilyMission}
          </p>
        </section>
      )}
    </div>
  );
}
