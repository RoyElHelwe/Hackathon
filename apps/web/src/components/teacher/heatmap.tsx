'use client';

import type { MasteryState } from '@tajriba/shared';
import { AlertTriangle, Check, Lock, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import { EmptyState } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { BAND_BAR, BAND_SOLID, MASTERY_CELL, SUBJECT_DOT, band } from './helpers';
import type { TeacherDashboard } from './types';

/** Cell look: red < 50 %, blue 50–69 %, cedar ≥ 70 % (best score); locked grey; stuck solid red. */
function cellLook(state: MasteryState, score: number, stuck: boolean): { cls: string; content: React.ReactNode } {
  if (state === 'LOCKED') return { cls: MASTERY_CELL.LOCKED, content: <Lock className="size-3.5" /> };
  if (stuck) return { cls: 'bg-flag text-white', content: <AlertTriangle className="size-4" strokeWidth={2.6} /> };
  if (state === 'MASTERED') return { cls: score ? BAND_SOLID[band(score)] : MASTERY_CELL.MASTERED, content: score || <Check className="size-4" strokeWidth={3} /> };
  if (state === 'IN_PROGRESS') return score ? { cls: BAND_SOLID[band(score)], content: score } : { cls: MASTERY_CELL.IN_PROGRESS, content: '…' };
  return { cls: MASTERY_CELL.AVAILABLE, content: null };
}

/** Students × topics grid colored by mastery. Stuck students are highlighted. */
export function Heatmap({ data, classId }: { data: TeacherDashboard; classId: string }) {
  const t = useTranslations('teacher.heatmap');
  const tm = useTranslations('common.mastery');
  const l = useL();

  // Grouped by localized subject name; the server order (map position) is kept inside a subject.
  const topics = useMemo(() => [...data.topics].sort((a, b) => l(a.subjectName).localeCompare(l(b.subjectName))), [data.topics, l]);
  const cellMap = useMemo(() => new Map(data.cells.map((c) => [`${c.studentId}:${c.topicId}`, c])), [data.cells]);
  const stuckSet = useMemo(() => new Set(data.stuck.map((s) => `${s.studentId}:${s.topicId}`)), [data.stuck]);
  const students = useMemo(() => [...data.students].sort((a, b) => Number(b.stuck) - Number(a.stuck) || a.name.localeCompare(b.name)), [data.students]);

  const masteredPct = (topicId: string) => {
    if (!students.length) return 0;
    const n = students.filter((s) => cellMap.get(`${s.id}:${topicId}`)?.state === 'MASTERED').length;
    return Math.round((n / students.length) * 100);
  };

  if (!topics.length) {
    const courseId = data.class.course?.id;
    return (
      <EmptyState
        mood="reading"
        title={t('noSkills')}
        body={t('noSkillsBody')}
        className="py-6"
        action={
          courseId ? (
            <Button asChild size="sm" variant="kidMint" data-testid="heatmap-open-course">
              <Link href={`/teacher/courses/${courseId}`}>
                <Wand2 /> {t('openCourse')}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!students.length) return <p className="p-6 text-center text-sm text-muted-foreground">{t('noStudents')}</p>;

  return (
    <div>
      <div className="overflow-x-auto" data-testid="heatmap">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 min-w-48 bg-card px-2 pb-2 text-start align-bottom">
                <span className="eyebrow">{t('student')}</span>
              </th>
              {topics.map((tp) => (
                <th key={tp.id} className="min-w-[84px] px-1 pb-2 align-bottom" scope="col">
                  <span className="flex flex-col items-center gap-1.5 text-center text-xs font-extrabold leading-tight text-muted-foreground">
                    <span className={cn('size-2.5 rounded-full', SUBJECT_DOT[tp.color] ?? 'bg-cedar')} aria-hidden />
                    <span className="line-clamp-2">{l(tp.name)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} data-testid="heatmap-row" data-stuck={s.stuck || undefined}>
                <th scope="row" className={cn('sticky start-0 z-10 rounded-[14px] px-2 py-1 text-start font-extrabold', s.stuck ? 'bg-flag-soft' : 'bg-card')}>
                  <Link href={`/teacher/students/${s.id}?classId=${classId}`} className="flex items-center gap-2.5 hover:underline">
                    <Avatar name={s.name} src={s.avatarUrl} className="size-8 text-[11px]" />
                    <span className="truncate">{s.name}</span>
                    {s.stuck && (
                      <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-flag px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white" title={t('stuckHint')}>
                        <AlertTriangle className="size-3" /> {t('stuck')}
                      </span>
                    )}
                  </Link>
                </th>
                {topics.map((tp) => {
                  const cell = cellMap.get(`${s.id}:${tp.id}`);
                  const state: MasteryState = cell?.state ?? 'LOCKED';
                  const stuck = stuckSet.has(`${s.id}:${tp.id}`);
                  const label = `${s.name} · ${l(tp.name)}: ${tm(state)}${cell?.bestScore ? ` (${cell.bestScore}%)` : ''}`;
                  const look = cellLook(state, cell?.bestScore ?? 0, stuck);
                  return (
                    <td key={tp.id} className="p-0">
                      <div
                        className={cn(
                          'flex h-11 items-center justify-center rounded-[12px] text-[13px] font-black tabular-nums transition-transform hover:scale-105',
                          look.cls,
                        )}
                        title={label}
                        aria-label={label}
                        data-state={state}
                      >
                        {look.content}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className="sticky start-0 z-10 bg-card px-2 pt-3 text-start">
                <span className="eyebrow">{t('classMastered')}</span>
              </th>
              {topics.map((tp) => {
                const pct = masteredPct(tp.id);
                return (
                  <td key={tp.id} className="px-1 pt-3">
                    <div className="h-2.5 overflow-hidden rounded-full bg-lock">
                      <div className={cn('h-full rounded-full', BAND_BAR[band(pct)])} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-center text-xs font-black tabular-nums">{pct}%</p>
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
  const items: { cls: string; label: string }[] = [
    { cls: BAND_SOLID.high, label: t('bandHigh') },
    { cls: BAND_SOLID.mid, label: t('bandMid') },
    { cls: BAND_SOLID.low, label: t('bandLow') },
    { cls: MASTERY_CELL.IN_PROGRESS, label: tm('IN_PROGRESS') },
    { cls: MASTERY_CELL.AVAILABLE, label: tm('AVAILABLE') },
    { cls: MASTERY_CELL.LOCKED, label: tm('LOCKED') },
  ];
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-border pt-4 text-xs font-bold text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className={cn('size-4 rounded-[5px]', it.cls)} aria-hidden />
          {it.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="flex size-4 items-center justify-center rounded-[5px] bg-flag text-white" aria-hidden>
          <AlertTriangle className="size-2.5" strokeWidth={3} />
        </span>
        {t('stuckLegend')}
      </span>
      <span>{t('scoreLegend')}</span>
    </div>
  );
}
