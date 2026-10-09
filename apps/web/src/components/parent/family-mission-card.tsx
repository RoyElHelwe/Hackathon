'use client';

import { ChevronRight, Clock, ShieldCheck, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
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
      <div className="border-b-2 border-border bg-flame-soft p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {subject && <Badge variant="default" className="bg-card">{l(subject.name)}</Badge>}
          {mission.topic && <Badge variant="outline" className="bg-card">{l(mission.topic.name)}</Badge>}
          <Badge variant="muted" className="bg-card">{tc(mission.difficulty)}</Badge>
        </div>
        <h2 className="text-2xl font-black leading-tight">{l(mission.title)}</h2>
        <p className="mt-2 font-semibold leading-relaxed text-muted-foreground">{l(mission.story)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-black">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-med-ink dark:text-ring">
            <Clock className="size-4" /> {t('minutes', { n: mission.estimatedMin })}
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-med-ink dark:text-ring">
            <Zap className="size-4 fill-current" /> {t('xp', { xp: mission.xpReward })}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {steps.length > 0 && (
          <details className="group rounded-[16px] border-2 border-border p-3 open:pb-4">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 font-black [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-5 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90 rtl-flip" /> {t('steps')}
            </summary>
            <ol className="mt-2 list-decimal space-y-1.5 ps-6 font-semibold leading-relaxed marker:font-black marker:text-cedar">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {safety && (
              <p className="mt-3 flex items-start gap-2 rounded-[12px] bg-cedar-soft px-3 py-2 text-sm font-semibold">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cedar-d dark:text-success" />
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
          <div className="flex items-center gap-3 rounded-[16px] bg-muted p-3">
            <Arzino mood="bored-waiting" size={64} animate={false} />
            <p className="text-sm font-bold text-muted-foreground">{t('noSubmissions')}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
