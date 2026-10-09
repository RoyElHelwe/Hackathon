'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Clock, Heart, RefreshCw, Sparkles, Sprout } from 'lucide-react';
import { motion } from 'motion/react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState, Thinking } from '@/components/app/states';
import { Bousla } from '@/components/bousla';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
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
      <div className="flex items-center gap-3 bg-gradient-to-br from-violet-soft via-card to-mint-soft p-5 pb-4">
        <Bousla mood={regenerating || isLoading ? 'thinking' : 'happy'} size={52} animate={false} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-extrabold leading-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{data ? <WeekOf iso={data.weekStart} /> : t('subtitle')}</p>
        </div>
        {data && (
          <Button variant="ghost" size="sm" onClick={regenerate} loading={regenerating} aria-label={t('regenerate')} data-testid="regenerate-summary">
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
          <p className="mt-3 rounded-[12px] bg-coral-soft px-3 py-2 text-sm font-semibold text-danger" role="alert">
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
        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t('highlights')}</h3>
        <ul className="space-y-2.5" dir={dir} lang={summary.locale}>
          {c.highlights.map((h, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 text-[17px] leading-relaxed"
              data-testid="summary-highlight"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-mint-soft text-success">
                <Sparkles className="size-4" />
              </span>
              <span>{h}</span>
            </motion.li>
          ))}
        </ul>
      </section>

      <section className="rounded-[16px] bg-sky-soft/70 p-4">
        <h3 className="mb-1.5 flex items-center gap-2 font-extrabold">
          <Sprout className="size-5 text-sky" /> {t('struggles')}
        </h3>
        {c.struggles.length ? (
          <ul className="list-disc space-y-1 ps-5 leading-relaxed" dir={dir} lang={summary.locale} data-testid="summary-struggles">
            {c.struggles.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t('noStruggles')}</p>
        )}
      </section>

      <section className="rounded-[16px] border-2 border-sunny/60 bg-sunny-soft p-4" data-testid="how-to-help">
        <h3 className="mb-1.5 flex items-center gap-2 font-extrabold">
          <Clock className="size-5 text-warning" /> {t('howToHelp')}
        </h3>
        <p className="text-[17px] leading-relaxed" dir={dir} lang={summary.locale}>
          {c.howToHelp}
        </p>
      </section>

      {c.suggestedFamilyMission && (
        <section className="rounded-[16px] bg-violet-soft p-4" data-testid="suggested-family-mission">
          <h3 className="mb-1.5 flex items-center gap-2 font-extrabold">
            <Heart className="size-5 text-coral" /> {t('familyMission')}
          </h3>
          <p className="leading-relaxed" dir={dir} lang={summary.locale}>
            {c.suggestedFamilyMission}
          </p>
        </section>
      )}
    </div>
  );
}
