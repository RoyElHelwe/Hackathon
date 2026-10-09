'use client';

import { Check, Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EYEBROW, masteryTone, TONE_TEXT } from '@/components/director/tone';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { ParentDashboard } from './types';

/** Strengths and struggles in plain, kind words. */
export function ProgressWords({ data }: { data: ParentDashboard }) {
  const t = useTranslations('parent.progress');
  const l = useL();
  const first = data.child.name.split(' ')[0];
  return (
    <Card data-testid="strengths-struggles">
      <CardContent className="grid gap-5 pt-5">
        <section>
          <h3 className={cn(EYEBROW, 'mb-2 text-cedar-ink dark:text-success')}>{t('strengths')}</h3>
          {data.strengths.length ? (
            <ul className="space-y-2">
              {data.strengths.map((s) => (
                <li key={s.topicKey} className="flex items-center gap-3 rounded-[14px] bg-cedar-soft px-3 py-2.5" data-testid="strength">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cedar text-white shadow-[0_2px_0_var(--cedar-d)]">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1 font-extrabold">{l(s.topicName)}</span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-black', TONE_TEXT[masteryTone(s.bestScore)], 'bg-card')}>
                    {t('bestScore', { score: s.bestScore })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">{t('noStrengths')}</p>
          )}
        </section>
        <section>
          <h3 className={cn(EYEBROW, 'mb-2 text-med-ink dark:text-ring')}>{t('struggles')}</h3>
          {data.struggles.length ? (
            <ul className="space-y-2">
              {data.struggles.map((s) => (
                <li key={s.topicKey} className="flex items-start gap-3 rounded-[14px] bg-med-soft px-3 py-2.5" data-testid="struggle">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-med text-white shadow-[0_2px_0_var(--med-d)]">
                    <Sprout className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold">{l(s.topicName)}</p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {first} {s.reasons.map((r) => t(`reason.${r}`)).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">{t('noStruggles')}</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
