'use client';

import type { MasteryState } from '@tajriba/shared';
import { Lock, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { topicIcon } from '@/components/app/subject-icon';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi, useL } from '@/lib/hooks';
import type { Graph } from '@/lib/types';
import { MASTERY_TILE, SUBJECT_DOT } from './helpers';
import type { Subject } from './types';

/** Read-only compact skill map: one tile per topic, colored by mastery. */
export function SkillTiles({ studentId }: { studentId: string }) {
  const t = useTranslations('teacher.student');
  const tm = useTranslations('common.mastery');
  const l = useL();
  const subjects = useApi<Subject[]>(`/subjects?studentId=${studentId}`);
  const [chosen, setPicked] = useState<string | null>(null);
  const withTopics = subjects.data?.filter((s) => s.topicCount > 0) ?? [];
  const picked = chosen && withTopics.some((s) => s.key === chosen) ? chosen : (withTopics[0]?.key ?? null);
  const graph = useApi<Graph>(picked ? `/subjects/${picked}/graph?studentId=${studentId}` : null);
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
              'inline-flex h-10 items-center gap-2 rounded-[14px] border-2 px-3.5 text-sm font-extrabold transition-colors',
              picked === s.key ? 'border-med bg-med-soft shadow-[0_3px_0_var(--med)]' : 'border-border bg-card shadow-[0_3px_0_var(--border)] hover:bg-muted',
            )}
            aria-pressed={picked === s.key}
          >
            <span className={cn('size-2.5 rounded-full', SUBJECT_DOT[s.color] ?? 'bg-cedar')} /> {l(s.name)}
          </button>
        ))}
      </div>
      {subjects.isLoading || graph.isLoading ? (
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
              const Icon = topicIcon(n.icon);
              return (
                <li key={n.id} className={cn('flex flex-col gap-2 rounded-[18px] border-2 p-3', MASTERY_TILE[n.state])} data-state={n.state} data-testid="skill-tile">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-[0_2px_0_var(--border)]">
                      {n.state === 'LOCKED' ? <Lock className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    {n.state === 'MASTERED' && (
                      <span className="flex items-center gap-1 font-display text-base font-black">
                        <Star className="size-3.5 fill-current" /> {n.bestScore}
                      </span>
                    )}
                  </div>
                  <p className="font-extrabold leading-tight">{l(n.name)}</p>
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
