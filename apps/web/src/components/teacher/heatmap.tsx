'use client';

import type { MasteryState } from '@tajriba/shared';
import { AlertTriangle, Lock } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import { MASTERY_CELL, SUBJECT_DOT, SUBJECT_ORDER } from './helpers';
import type { TeacherDashboard } from './types';

/** Students × topics grid colored by mastery. Stuck students are highlighted. */
export function Heatmap({ data, classId }: { data: TeacherDashboard; classId: string }) {
  const t = useTranslations('teacher.heatmap');
  const tm = useTranslations('common.mastery');
  const l = useL();

  const topics = useMemo(
    () => [...data.topics].sort((a, b) => SUBJECT_ORDER.indexOf(a.subjectKey) - SUBJECT_ORDER.indexOf(b.subjectKey)),
    [data.topics],
  );
  const cellMap = useMemo(() => new Map(data.cells.map((c) => [`${c.studentId}:${c.topicId}`, c])), [data.cells]);
  const stuckSet = useMemo(() => new Set(data.stuck.map((s) => `${s.studentId}:${s.topicId}`)), [data.stuck]);
  const students = useMemo(() => [...data.students].sort((a, b) => Number(b.stuck) - Number(a.stuck) || a.name.localeCompare(b.name)), [data.students]);

  const masteredPct = (topicId: string) => {
    if (!students.length) return 0;
    const n = students.filter((s) => cellMap.get(`${s.id}:${topicId}`)?.state === 'MASTERED').length;
    return Math.round((n / students.length) * 100);
  };

  if (!students.length) return <p className="p-6 text-center text-sm text-muted-foreground">{t('noStudents')}</p>;

  return (
    <div>
      <div className="overflow-x-auto" data-testid="heatmap">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 min-w-44 bg-card px-2 text-start align-bottom text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('student')}</th>
              {topics.map((tp) => (
                <th key={tp.id} className="min-w-[76px] px-1 pb-1 align-bottom" scope="col">
                  <span className="flex flex-col items-center gap-1 text-center text-[11px] font-bold leading-tight text-muted-foreground">
                    <span className={cn('size-2 rounded-full', SUBJECT_DOT[tp.color] ?? 'bg-violet')} aria-hidden />
                    <span className="line-clamp-2">{l(tp.name)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} data-testid="heatmap-row" data-stuck={s.stuck || undefined}>
                <th scope="row" className={cn('sticky start-0 z-10 rounded-[12px] px-2 py-1 text-start font-semibold', s.stuck ? 'bg-coral-soft' : 'bg-card')}>
                  <Link href={`/teacher/students/${s.id}?classId=${classId}`} className="flex items-center gap-2 hover:underline">
                    <Avatar name={s.name} src={s.avatarUrl} className="size-7 text-[10px]" />
                    <span className="truncate">{s.name}</span>
                    {s.stuck && (
                      <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-card px-1.5 py-0.5 text-[10px] font-extrabold text-danger" title={t('stuckHint')}>
                        <AlertTriangle className="size-3" /> {t('stuck')}
                      </span>
                    )}
                  </Link>
                </th>
                {topics.map((tp) => {
                  const cell = cellMap.get(`${s.id}:${tp.id}`);
                  const state: MasteryState = cell?.state ?? 'LOCKED';
                  const stuck = stuckSet.has(`${s.id}:${tp.id}`);
                  const label = `${s.name} · ${l(tp.name)}: ${tm(state)}${state === 'MASTERED' ? ` (${cell?.bestScore}%)` : ''}`;
                  return (
                    <td key={tp.id} className="p-0">
                      <div
                        className={cn(
                          'flex h-10 items-center justify-center rounded-[10px] text-xs font-extrabold tabular-nums transition-transform hover:scale-105',
                          MASTERY_CELL[state],
                          stuck && 'ring-2 ring-coral ring-offset-2 ring-offset-card',
                        )}
                        title={label}
                        aria-label={label}
                        data-state={state}
                      >
                        {state === 'MASTERED' && cell?.bestScore ? cell.bestScore : null}
                        {state === 'IN_PROGRESS' && (stuck ? <AlertTriangle className="size-4 text-danger" /> : '…')}
                        {state === 'LOCKED' && <Lock className="size-3.5 opacity-60" />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="sticky start-0 z-10 bg-card px-2 pt-2 text-start text-xs font-bold text-muted-foreground">{t('classMastered')}</th>
              {topics.map((tp) => {
                const pct = masteredPct(tp.id);
                return (
                  <td key={tp.id} className="px-1 pt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-center text-[11px] font-bold tabular-nums text-muted-foreground">{pct}%</p>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  const tm = useTranslations('common.mastery');
  const t = useTranslations('teacher.heatmap');
  const states: MasteryState[] = ['MASTERED', 'IN_PROGRESS', 'AVAILABLE', 'LOCKED'];
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
      {states.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn('size-3.5 rounded-[5px]', MASTERY_CELL[s])} aria-hidden />
          {tm(s)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-[5px] ring-2 ring-coral" aria-hidden />
        {t('stuckLegend')}
      </span>
      <span>{t('scoreLegend')}</span>
    </div>
  );
}
