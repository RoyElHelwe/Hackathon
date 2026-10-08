'use client';

import { Leaf, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
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
          <h3 className="mb-2 flex items-center gap-2 font-extrabold">
            <span className="flex size-8 items-center justify-center rounded-full bg-sunny-soft text-warning">
              <Sun className="size-4" />
            </span>
            {t('strengths')}
          </h3>
          {data.strengths.length ? (
            <ul className="space-y-2">
              {data.strengths.map((s) => (
                <li key={s.topicKey} className="flex items-center justify-between gap-3 rounded-[14px] bg-muted/60 px-3 py-2.5" data-testid="strength">
                  <span className="font-bold">{l(s.topicName)}</span>
                  <span className="shrink-0 text-xs font-bold text-success">{t('bestScore', { score: s.bestScore })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noStrengths')}</p>
          )}
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-2 font-extrabold">
            <span className="flex size-8 items-center justify-center rounded-full bg-sky-soft text-sky">
              <Leaf className="size-4" />
            </span>
            {t('struggles')}
          </h3>
          {data.struggles.length ? (
            <ul className="space-y-2">
              {data.struggles.map((s) => (
                <li key={s.topicKey} className="rounded-[14px] bg-sky-soft/60 px-3 py-2.5" data-testid="struggle">
                  <p className="font-bold">{l(s.topicName)}</p>
                  <p className="text-sm text-muted-foreground">
                    {first} {s.reasons.map((r) => t(`reason.${r}`)).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noStruggles')}</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
