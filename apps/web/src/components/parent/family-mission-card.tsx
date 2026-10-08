'use client';

import { ChevronRight, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useL } from '@/lib/hooks';
import { FamilySubmission } from './family-submission';
import type { FamilyMission } from './types';

/** A family mission with the story, steps, and each child's submission. */
export function FamilyMissionCard({ mission }: { mission: FamilyMission }) {
  const t = useTranslations('parent.family');
  const tc = useTranslations('common.difficulty');
  const l = useL();
  const steps = l(mission.steps) ?? [];
  const safety = l(mission.safetyNotes);
  const subject = mission.topic?.subject;

  return (
    <Card className="overflow-hidden" data-testid="family-mission-card">
      <div className="bg-gradient-to-br from-coral-soft via-card to-sunny-soft p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {subject && <Badge variant="default">{l(subject.name)}</Badge>}
          {mission.topic && <Badge variant="outline">{l(mission.topic.name)}</Badge>}
          <Badge variant="muted">{tc(mission.difficulty)}</Badge>
        </div>
        <h2 className="font-display text-2xl font-extrabold leading-tight">{l(mission.title)}</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">{l(mission.story)}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-sky" /> {t('minutes', { n: mission.estimatedMin })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-4 text-warning" /> {t('xp', { xp: mission.xpReward })}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {steps.length > 0 && (
          <details className="group rounded-[16px] bg-muted/60 p-3 open:pb-4">
            <summary className="flex cursor-pointer list-none items-center gap-1 font-extrabold [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-5 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90 rtl-flip" /> {t('steps')}
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 ps-6 leading-relaxed">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {safety && (
              <p className="mt-3 flex items-start gap-2 rounded-[12px] bg-mint-soft px-3 py-2 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                <span>
                  <span className="font-bold">{t('safety')}: </span>
                  {safety}
                </span>
              </p>
            )}
          </details>
        )}

        {mission.childSubmissions.length ? (
          mission.childSubmissions.map((s) => <FamilySubmission key={s.id} sub={s} />)
        ) : (
          <p className="text-sm font-semibold text-muted-foreground">{t('noSubmissions')}</p>
        )}
      </div>
    </Card>
  );
}
