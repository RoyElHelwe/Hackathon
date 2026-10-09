'use client';

import { useTranslations } from 'next-intl';
import { TopicGlyph } from '@/components/app/subject-icon';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import { EYEBROW, masteryTone, TONE_TEXT } from './tone';
import type { CoverageCourse } from './types';

/** Cell colors follow the 3-color mastery rule: red < 50 %, blue 50–69 %, cedar ≥ 70 %. 0 % = not started (quiet surface). */
export function cellClass(pct: number): string {
  if (pct <= 0) return 'bg-muted text-muted-foreground/70';
  const tone = masteryTone(pct);
  if (tone === 'cedar') return 'bg-cedar text-white shadow-[inset_0_-4px_0_var(--cedar-d)]';
  if (tone === 'med') return 'bg-med-soft text-med-ink shadow-[inset_0_-4px_0_color-mix(in_oklab,var(--med)_35%,transparent)] dark:text-white';
  return 'bg-flag-soft text-flag-d shadow-[inset_0_-4px_0_color-mix(in_oklab,var(--flag)_30%,transparent)] dark:text-danger';
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
            <th scope="col" className={cn(EYEBROW, 'sticky start-0 z-10 min-w-48 bg-card px-3 pb-2 text-start text-muted-foreground')}>
              {t('topic')}
            </th>
            {sections.map((s) => (
              <th key={s.id} scope="col" className="min-w-24 px-2 pb-2 text-center font-black">
                <span className="block">{s.name}</span>
                <span className="block text-[11px] font-bold text-muted-foreground">{t('students', { n: s.students })}</span>
              </th>
            ))}
            {sections.length > 1 && (
              <th scope="col" className={cn(EYEBROW, 'min-w-20 px-2 pb-2 text-center text-muted-foreground')}>
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
                <th scope="row" className="sticky start-0 z-10 bg-card px-3 py-1 text-start font-bold">
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
                {sections.length > 1 && <td className={cn('px-2 text-center font-black tabular-nums', avg > 0 ? TONE_TEXT[masteryTone(avg)] : 'text-muted-foreground')}>{avg}%</td>}
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
      <td className="h-12 rounded-[12px] border-2 border-dashed border-border text-center text-muted-foreground/70" title={label} aria-label={label} data-testid="coverage-cell">
        —
      </td>
    );
  return (
    <td
      className={cn('h-12 rounded-[12px] text-center font-black tabular-nums transition-[outline] hover:outline-2 hover:outline-offset-1 hover:outline-med', cellClass(pct))}
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
  const steps: { pct: number; label: string }[] = [
    { pct: 0, label: t('none') },
    { pct: 30, label: t('legendLow') },
    { pct: 60, label: t('legendMid') },
    { pct: 85, label: t('legendHigh') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground" data-testid="coverage-legend">
      <span className={cn(EYEBROW, 'me-1')}>{t('legend')}</span>
      {steps.map((s) => (
        <span key={s.pct} className={cn('inline-flex h-8 items-center rounded-[10px] px-3 font-black', cellClass(s.pct))}>
          {s.label}
        </span>
      ))}
    </div>
  );
}
