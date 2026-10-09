'use client';

import type { I18nText, MasteryState } from '@tajriba/shared';
import { Check, Lock, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/app/states';
import { SubjectIcon } from '@/components/app/subject-icon';
import { Arzino } from '@/components/arzino';
import { masteryTone, TONE_TEXT } from '@/components/director/tone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi, useL } from '@/lib/hooks';
import type { MiniGraph } from './types';

/** Path node look, matching the student path: cedar done (check), cedar star for "now", grey locked. */
const NODE: Record<MasteryState, string> = {
  MASTERED: 'bg-cedar text-white shadow-[0_6px_0_var(--cedar-d)]',
  IN_PROGRESS: 'bg-cedar text-white shadow-[0_6px_0_var(--cedar-d)] ring-[6px] ring-cedar-soft',
  AVAILABLE: 'bg-cedar text-white shadow-[0_6px_0_var(--cedar-d)] ring-[6px] ring-cedar-soft',
  LOCKED: 'bg-lock text-muted-foreground shadow-[0_6px_0_var(--lock-d)]',
};
/** Zig-zag offsets (px, inline-start) so the path winds like the student one. */
const WIND = [8, 44, 68, 44];

/** Orders topics so prerequisites come first (stable topological sort). */
function ordered(g: MiniGraph) {
  const indeg = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const e of g.edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const out: MiniGraph['nodes'] = [];
  const left = [...g.nodes];
  while (left.length) {
    const i = Math.max(0, left.findIndex((n) => (indeg.get(n.id) ?? 0) === 0));
    const [n] = left.splice(i, 1);
    out.push(n);
    for (const e of g.edges) if (e.source === n.id) indeg.set(e.target, (indeg.get(e.target) ?? 1) - 1);
  }
  return out;
}

/** Simplified, parent-friendly skill map: a path of topic tiles coloured by mastery. */
export function SkillPath({ studentId }: { studentId: string }) {
  const t = useTranslations('parent.map');
  const tm = useTranslations('common.mastery');
  const l = useL();
  const subjects = useApi<{ key: string; name: I18nText; icon: string; topicCount: number }[]>(`/subjects?studentId=${studentId}`);
  const withTopics = subjects.data?.filter((s) => s.topicCount > 0) ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  const subject = chosen && withTopics.some((s) => s.key === chosen) ? chosen : (withTopics[0]?.key ?? null);
  const graph = useApi<MiniGraph>(subject ? `/subjects/${subject}/graph?studentId=${studentId}` : null);
  const { data, error } = graph;
  const isLoading = subjects.isLoading || graph.isLoading;
  const emptyTitle = !subjects.data?.length ? t('noClasses') : !withTopics.length ? t('noSkills') : t('empty');
  const nodes = useMemo(() => (data ? ordered(data) : []), [data]);
  const mastered = nodes.filter((n) => n.state === 'MASTERED').length;

  return (
    <Card data-testid="skill-map">
      <CardHeader className="flex-row items-center gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl">{t('title')}</CardTitle>
          <CardDescription className="font-semibold">{t('subtitle')}</CardDescription>
        </div>
        <Arzino mood="reading" size={72} animate={false} className="-my-3 shrink-0" />
      </CardHeader>
      <CardContent>
        {withTopics.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2" role="tablist">
            {withTopics.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={s.key === subject}
                onClick={() => setChosen(s.key)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-[14px] border-2 px-3 text-sm font-extrabold transition-colors',
                  s.key === subject ? 'border-med bg-med-soft text-med-ink shadow-[0_3px_0_var(--med)] dark:text-white' : 'border-border bg-card shadow-[0_3px_0_var(--border)] hover:bg-muted',
                )}
                data-testid={`skill-subject-${s.key}`}
              >
                <SubjectIcon icon={s.icon} /> {l(s.name)}
              </button>
            ))}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-3/4 rounded-full" style={{ marginInlineStart: WIND[i % WIND.length] }} />
            ))}
          </div>
        ) : error || !nodes.length ? (
          <EmptyState mood="bored-waiting" title={emptyTitle} className="py-4" />
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <Progress value={(mastered / nodes.length) * 100} barClassName="bg-cedar" className="h-3" />
              <span className="shrink-0 text-sm font-black text-cedar-ink dark:text-success">{t('mastered', { count: mastered, total: nodes.length })}</span>
            </div>
            <ol className="space-y-5 pb-2">
              {nodes.map((n, i) => {
                const now = n.state === 'AVAILABLE' || n.state === 'IN_PROGRESS';
                const Icon = n.state === 'MASTERED' ? Check : n.state === 'LOCKED' ? Lock : Star;
                return (
                  <li
                    key={n.id}
                    className="flex items-center gap-4"
                    style={{ marginInlineStart: WIND[i % WIND.length] }}
                    data-testid="skill-tile"
                    data-state={n.state}
                  >
                    <span className={cn('relative flex size-[60px] shrink-0 items-center justify-center rounded-full', NODE[n.state])}>
                      <Icon className={cn('size-7', n.state !== 'LOCKED' && 'drop-shadow-[0_2px_0_rgba(0,0,0,0.15)]', now && 'fill-current')} strokeWidth={n.state === 'MASTERED' ? 3.5 : 2.5} />
                    </span>
                    <div className="min-w-0">
                      <p className={cn('font-extrabold leading-tight [overflow-wrap:anywhere]', n.state === 'LOCKED' && 'text-muted-foreground')}>{l(n.name)}</p>
                      <p className={cn('text-xs font-black uppercase tracking-[0.06em]', now ? 'text-cedar-ink dark:text-success' : 'text-muted-foreground')}>
                        {tm(n.state)}
                        {n.state === 'MASTERED' && n.bestScore > 0 && <span className={cn('ms-1.5', TONE_TEXT[masteryTone(n.bestScore)])}>· {n.bestScore}%</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </CardContent>
    </Card>
  );
}
