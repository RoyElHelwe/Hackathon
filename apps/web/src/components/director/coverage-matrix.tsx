'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { CoverageRow } from './types';

const SUBJECT_DOT: Record<string, string> = { violet: 'bg-violet', sky: 'bg-sky', mint: 'bg-mint', green: 'bg-green', coral: 'bg-coral', sunny: 'bg-sunny' };

/** Sequential single-hue scale: 0 → muted surface, 100 → full mint. */
export function cellStyle(pct: number): React.CSSProperties {
  if (pct <= 0) return { background: 'var(--muted)' };
  const mix = Math.round(18 + (pct / 100) * 82);
  return { background: `color-mix(in oklab, var(--mint) ${mix}%, var(--muted))` };
}

interface Group {
  key: string;
  grade: number;
  subject: CoverageRow['subjectName'];
  color: string;
  rows: CoverageRow[];
}

export function CoverageMatrix({ rows, classes }: { rows: CoverageRow[]; classes: { id: string; name: string }[] }) {
  const t = useTranslations('director.coverage');
  const l = useL();
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of rows) {
      const key = `${r.gradeLevel}:${r.subjectKey}`;
      if (!map.has(key)) map.set(key, { key, grade: r.gradeLevel, subject: r.subjectName, color: r.color, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()].sort((a, b) => a.grade - b.grade);
  }, [rows]);

  return (
    <div className="overflow-x-auto" data-testid="coverage-matrix">
      <table className="w-full border-separate border-spacing-[3px] text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky start-0 z-10 min-w-48 bg-card px-3 pb-2 text-start text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {t('topic')}
            </th>
            {classes.map((c) => (
              <th key={c.id} scope="col" className="min-w-24 px-2 pb-2 text-center font-extrabold">
                {c.name}
              </th>
            ))}
            <th scope="col" className="min-w-20 px-2 pb-2 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {t('avg')}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              <tr>
                <th colSpan={classes.length + 2} scope="colgroup" className="sticky start-0 bg-card px-3 pb-1 pt-4 text-start">
                  <span className="inline-flex items-center gap-2 font-extrabold">
                    <span className={cn('size-2.5 rounded-full', SUBJECT_DOT[g.color] ?? 'bg-primary')} />
                    {l(g.subject)}
                    <span className="font-semibold text-muted-foreground">· {t('grade', { n: g.grade })}</span>
                  </span>
                </th>
              </tr>
              {g.rows.map((r) => {
                const byClass = new Map(r.classes.map((c) => [c.classId, c.pct]));
                const vals = classes.map((c) => byClass.get(c.id) ?? 0);
                const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
                return (
                  <tr key={r.topicId} data-testid="coverage-row">
                    <th scope="row" className="sticky start-0 z-10 bg-card px-3 py-1 text-start font-semibold">
                      {l(r.topicName)}
                    </th>
                    {classes.map((c, i) => (
                      <Cell key={c.id} pct={vals[i]} label={t('cell', { topic: l(r.topicName), cls: c.name, pct: vals[i] })} />
                    ))}
                    <td className="px-2 text-center font-extrabold tabular-nums text-muted-foreground">{avg}%</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ pct, label }: { pct: number; label: string }) {
  return (
    <td
      className={cn('h-11 rounded-[10px] text-center font-bold tabular-nums transition-shadow hover:ring-2 hover:ring-primary/60', pct >= 45 ? 'text-ink' : pct > 0 ? 'text-foreground' : 'text-muted-foreground/70')}
      style={cellStyle(pct)}
      title={label}
      aria-label={label}
      data-testid="coverage-cell"
    >
      {pct > 0 ? `${pct}%` : '·'}
    </td>
  );
}

export function CoverageLegend() {
  const t = useTranslations('director.coverage');
  const steps = [0, 25, 50, 75, 100];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground" data-testid="coverage-legend">
      <span>{t('none')}</span>
      <div className="flex gap-1">
        {steps.map((s) => (
          <span key={s} className={cn('flex h-6 w-11 items-center justify-center rounded-[6px] font-bold tabular-nums', s >= 45 ? 'text-ink' : 'text-foreground')} style={cellStyle(s)}>
            {s}%
          </span>
        ))}
      </div>
      <span>{t('legend')}</span>
    </div>
  );
}
