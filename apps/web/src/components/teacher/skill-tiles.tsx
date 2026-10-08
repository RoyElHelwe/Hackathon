'use client';

import type { MasteryState } from '@tajriba/shared';
import { Box, Circle, Landmark, Lock, Ruler, Sparkles, Square, Star, Triangle, Zap, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi, useL } from '@/lib/hooks';
import type { Graph } from '@/lib/types';
import { MASTERY_TILE, SUBJECT_DOT } from './helpers';
import type { Subject } from './types';

const ICONS: Record<string, LucideIcon> = {
  square: Square,
  cube: Box,
  angle: Triangle,
  triangle: Triangle,
  circle: Circle,
  ruler: Ruler,
  zap: Zap,
  landmark: Landmark,
};

/** Read-only compact skill map: one tile per topic, colored by mastery. */
export function SkillTiles({ studentId }: { studentId: string }) {
  const t = useTranslations('teacher.student');
  const tm = useTranslations('common.mastery');
  const l = useL();
  const subjects = useApi<Subject[]>('/subjects');
  const [picked, setPicked] = useState('math');
  const graph = useApi<Graph>(`/subjects/${picked}/graph?studentId=${studentId}`);
  const withTopics = subjects.data?.filter((s) => s.topicCount > 0) ?? [];
  const order: MasteryState[] = ['MASTERED', 'IN_PROGRESS', 'AVAILABLE', 'LOCKED'];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {withTopics.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setPicked(s.key)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border-2 px-3 text-sm font-bold transition-colors',
              picked === s.key ? 'border-primary bg-violet-soft' : 'border-border bg-card hover:border-primary/40',
            )}
            aria-pressed={picked === s.key}
          >
            <span className={cn('size-2.5 rounded-full', SUBJECT_DOT[s.color] ?? 'bg-violet')} /> {l(s.name)}
          </button>
        ))}
      </div>
      {graph.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : graph.error ? (
        <ErrorState message={graph.error.message} onRetry={() => graph.refetch()} className="py-4" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="skill-tiles">
          {[...(graph.data?.nodes ?? [])]
            .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))
            .map((n) => {
              const Icon = ICONS[n.icon] ?? Sparkles;
              return (
                <li key={n.id} className={cn('flex flex-col gap-2 rounded-[18px] p-3', MASTERY_TILE[n.state])} data-state={n.state} data-testid="skill-tile">
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-full bg-card/70 text-foreground">
                      {n.state === 'LOCKED' ? <Lock className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    {n.state === 'MASTERED' && (
                      <span className="flex items-center gap-1 text-sm font-extrabold">
                        <Star className="size-3.5 fill-current" /> {n.bestScore}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-extrabold leading-tight">{l(n.name)}</p>
                  <p className="text-xs font-semibold opacity-80">{tm(n.state)}</p>
                </li>
              );
            })}
          {!graph.data?.nodes.length && <li className="col-span-full text-sm text-muted-foreground">{t('noTopics')}</li>}
        </ul>
      )}
    </div>
  );
}
