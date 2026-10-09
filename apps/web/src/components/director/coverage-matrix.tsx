'use client';

import { useTranslations } from 'next-intl';
import { TopicGlyph } from '@/components/app/subject-icon';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { CoverageCourse } from './types';

/** Sequential single-hue scale: 0 → muted surface, 100 → full mint. */
export function cellStyle(pct: number): React.CSSProperties {
  if (pct <= 0) return { background: 'var(--muted)' };
  const mix = Math.round(18 + (pct / 100) * 82);
  return { background: `color-mix(in oklab, var(--mint) ${mix}%, var(--muted))` };
}

/** One course: rows = the course's skills, columns = its sections, cell = % of the section's students who mastered it. */
export function CoverageMatrix({ course }: { course: CoverageCourse }) {
  const t = useTranslations('director.coverage');
  const l = useL();
  const sections = course.sections;

  return (
    <div className="overflow-x-auto" data-testid="coverage-course">
      <table className="w-full border-separate border-spacing-[3px] text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky start-0 z-10 min-w-48 bg-card px-3 pb-2 text-start text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              {t('topic')}
            </th>
            {sections.map((s) => (
              <th key={s.id} scope="col" className="min-w-24 px-2 pb-2 text-center font-extrabold">
                <span className="block">{s.name}</span>
                <span className="block text-[11px] font-semibold text-muted-foreground">{t('students', { n: s.students })}</span>
              </th>
            ))}
            {sections.length > 1 && (
              <th scope="col" className="min-w-20 px-2 pb-2 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {t('avg')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {course.topics.map((r) => {
            const bySection = new Map(r.sections.map((c) => [c.classId, c.pct]));
            const vals = sections.map((s) => bySection.get(s.id) ?? null);
            const shown = vals.filter((v): v is number => v !== null);
            const avg = shown.length ? Math.round(shown.reduce((a, b) => a + b, 0) / shown.length) : 0;
            return (
              <tr key={r.topicId} data-testid="coverage-row">
                <th scope="row" className="sticky start-0 z-10 bg-card px-3 py-1 text-start font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center text-base text-muted-foreground">
                      <TopicGlyph topicKey={r.topicKey} icon={r.icon} />
                    </span>
                    {l(r.topicName)}
                  </span>
                </th>
                {sections.map((s, i) => (
                  <Cell key={s.id} pct={vals[i]} label={vals[i] === null ? t('notInSection', { topic: l(r.topicName), cls: s.name }) : t('cell', { topic: l(r.topicName), cls: s.name, pct: vals[i] ?? 0 })} />
                ))}
                {sections.length > 1 && <td className="px-2 text-center font-extrabold tabular-nums text-muted-foreground">{avg}%</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null)
    return (
      <td className="h-11 rounded-[10px] border-2 border-dashed border-border text-center text-muted-foreground/70" title={label} aria-label={label} data-testid="coverage-cell">
        —
      </td>
    );
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
