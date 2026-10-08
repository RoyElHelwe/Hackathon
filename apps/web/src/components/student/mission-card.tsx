'use client';

import { ChevronRight, Clock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { Mission } from '@/lib/types';
import { subjectStyle, topicEmoji } from './subject-style';

export function missionHref(m: Pick<Mission, 'id' | 'mySubmission'>) {
  const s = m.mySubmission;
  if (s && s.status !== 'IN_PROGRESS') return `/student/submissions/${s.id}`;
  return `/student/missions/${m.id}`;
}

export function MissionCard({ mission, className }: { mission: Mission; className?: string }) {
  const t = useTranslations('student');
  const tc = useTranslations('common');
  const l = useL();
  const st = subjectStyle(mission.topic?.subject?.key);
  const status = mission.mySubmission?.status;
  return (
    <Link href={missionHref(mission)} className={cn('group block', className)} data-testid="mission-card">
      <div className="flex items-center gap-4 rounded-[20px] border-2 border-border bg-card p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
        <div className={cn('flex size-14 shrink-0 items-center justify-center rounded-[16px] text-3xl', st.soft)} aria-hidden>
          {topicEmoji(mission.topic?.key ?? '')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold leading-tight">{l(mission.title)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="sunny">⚡ {t('xp', { xp: mission.xpReward })}</Badge>
            <Badge variant="muted">
              <Clock /> {tc('minutes', { n: mission.estimatedMin })}
            </Badge>
            <Badge variant="outline">{tc(`difficulty.${mission.difficulty}`)}</Badge>
            {mission.audience === 'FAMILY' && (
              <Badge variant="coral">
                <Users /> {t('family')}
              </Badge>
            )}
            {status && <Badge variant={status === 'VALIDATED' ? 'mint' : status === 'RETRY' ? 'coral' : 'sky'}>{tc(`status.${status}`)}</Badge>}
          </div>
        </div>
        <ChevronRight className="rtl-flip size-6 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
