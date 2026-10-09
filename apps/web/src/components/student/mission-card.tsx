'use client';

import { ChevronRight, Clock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { Mission } from '@/lib/types';
import { TopicGlyph } from '@/components/app/subject-icon';
import { subjectStyle } from './subject-style';

export function missionHref(m: Pick<Mission, 'id' | 'mySubmission'>) {
  const s = m.mySubmission;
  if (s && s.status !== 'IN_PROGRESS') return `/student/submissions/${s.id}`;
  return `/student/missions/${m.id}`;
}

export function MissionCard({ mission, className }: { mission: Mission; className?: string }) {
  const t = useTranslations('student');
  const tc = useTranslations('common');
  const l = useL();
  const st = subjectStyle(mission.topic?.subject?.key, mission.topic?.subject?.color, mission.topic?.subject?.icon);
  const status = mission.mySubmission?.status;
  return (
    <Link href={missionHref(mission)} className={cn('group block', className)} data-testid="mission-card">
      <div className="chunky chunky-hover flex items-center gap-4 rounded-[20px] p-3.5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-[16px] text-3xl text-white" style={{ background: st.hex, boxShadow: `0 4px 0 ${st.hexD}` }} aria-hidden>
          <TopicGlyph topicKey={mission.topic?.key} icon={mission.topic?.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-black leading-tight">{l(mission.title)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="sky">⚡ {t('xp', { xp: mission.xpReward })}</Badge>
            <Badge variant="muted">
              <Clock /> {tc('minutes', { n: mission.estimatedMin })}
            </Badge>
            <Badge variant="outline">{tc(`difficulty.${mission.difficulty}`)}</Badge>
            {mission.audience === 'FAMILY' && (
              <Badge variant="sunny">
                <Users /> {t('family')}
              </Badge>
            )}
            {status && <Badge variant={status === 'VALIDATED' ? 'mint' : status === 'RETRY' ? 'sunny' : 'sky'}>{tc(`status.${status}`)}</Badge>}
          </div>
        </div>
        <ChevronRight className="rtl-flip size-6 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
