'use client';

import type { MasteryState } from '@tajriba/shared';
import { Box, Circle, Compass, FlaskConical, Lock, Map as MapIcon, Ruler, Square, Star, Triangle, TriangleRight, Zap, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { EmptyState } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi, useL } from '@/lib/hooks';
import type { MiniGraph } from './types';

const ICONS: Record<string, LucideIcon> = { square: Square, cube: Box, angle: TriangleRight, circle: Circle, triangle: Triangle, ruler: Ruler, zap: Zap, flask: FlaskConical };

const STATE_STYLE: Record<MasteryState, { tile: string; icon: string }> = {
  MASTERED: { tile: 'border-sunny bg-sunny-soft', icon: 'bg-sunny text-ink' },
  IN_PROGRESS: { tile: 'border-sky/50 bg-sky-soft', icon: 'bg-sky text-white' },
  AVAILABLE: { tile: 'border-primary/30 bg-violet-soft', icon: 'bg-primary text-white' },
  LOCKED: { tile: 'border-border bg-muted/60 opacity-70', icon: 'bg-muted text-muted-foreground' },
};

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
  const { data, isLoading, error } = useApi<MiniGraph>(`/subjects/math/graph?studentId=${studentId}`);
  const nodes = useMemo(() => (data ? ordered(data) : []), [data]);
  const mastered = nodes.filter((n) => n.state === 'MASTERED').length;

  return (
    <Card data-testid="skill-map">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="size-5 text-primary" /> {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : error || !nodes.length ? (
          <EmptyState title={t('empty')} className="py-4" />
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <Progress value={(mastered / nodes.length) * 100} barClassName="bg-gradient-to-r from-sunny to-mint" className="h-2.5" />
              <span className="shrink-0 text-sm font-bold text-muted-foreground">{t('mastered', { count: mastered, total: nodes.length })}</span>
            </div>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {nodes.map((n) => {
                const Icon = n.state === 'LOCKED' ? Lock : (ICONS[n.icon] ?? Compass);
                const s = STATE_STYLE[n.state];
                return (
                  <li key={n.id} className={cn('relative flex items-center gap-2.5 rounded-[16px] border-2 p-2.5', s.tile)} data-testid="skill-tile" data-state={n.state}>
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', s.icon)}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight [overflow-wrap:anywhere]">{l(n.name)}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{tm(n.state)}</p>
                    </div>
                    {n.state === 'MASTERED' && <Star className="absolute -top-2 end-2 size-5 fill-sunny text-sunny drop-shadow-sm" aria-hidden />}
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
