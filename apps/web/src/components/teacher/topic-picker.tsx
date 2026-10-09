'use client';

import { AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useL } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { SUBJECT_DOT } from './helpers';
import type { DashTopic, TeacherDashboard } from './types';

interface Props {
  dashboard: TeacherDashboard;
  subjectKey: string | null;
  topicId: string | null;
  onSubject: (k: string) => void;
  onTopic: (id: string) => void;
}

/** Subject chips, then topic chips with a mastery hint for the selected class. */
export function TopicPicker({ dashboard, subjectKey, topicId, onSubject, onTopic }: Props) {
  const t = useTranslations('teacher.studio');
  const l = useL();
  // The class's subjects come from its visible skills (one per subject, sorted by localized name).
  const withTopics = [...new Map(dashboard.topics.map((tp) => [tp.subjectKey, { key: tp.subjectKey, name: tp.subjectName, color: tp.color }])).values()].sort((a, b) =>
    l(a.name).localeCompare(l(b.name)),
  );
  const topics = dashboard.topics.filter((tp) => tp.subjectKey === subjectKey);
  const total = dashboard.students.length;

  const mastered = (tp: DashTopic) => dashboard.cells.filter((c) => c.topicId === tp.id && c.state === 'MASTERED').length;
  const stuck = (tp: DashTopic) => dashboard.stuck.filter((s) => s.topicId === tp.id).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-2">{t('subject')}</p>
        <div className="flex flex-wrap gap-2">
          {withTopics.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSubject(s.key)}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-[14px] border-2 px-4 text-sm font-extrabold transition-colors',
                subjectKey === s.key ? 'border-med-d bg-med text-white shadow-[0_3px_0_var(--med-d)]' : 'border-border bg-card shadow-[0_3px_0_var(--border)] hover:bg-muted',
              )}
              aria-pressed={subjectKey === s.key}
              data-testid={`subject-chip-${s.key}`}
            >
              <span className={cn('size-2.5 rounded-full', SUBJECT_DOT[s.color] ?? 'bg-cedar', subjectKey === s.key && 'ring-2 ring-white/70')} />
              {l(s.name)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="eyebrow mb-2">{t('topic')}</p>
        {topics.length ? (
          <div className="flex flex-wrap gap-2">
            {topics.map((tp) => {
              const active = topicId === tp.id;
              const st = stuck(tp);
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => onTopic(tp.id)}
                  className={cn(
                    'flex min-h-16 flex-col items-start justify-center rounded-[16px] border-2 px-4 py-2 text-start transition-colors',
                    active ? 'border-med bg-med-soft shadow-[0_4px_0_var(--med)]' : 'border-border bg-card shadow-[0_4px_0_var(--border)] hover:bg-muted',
                  )}
                  aria-pressed={active}
                  data-testid={`topic-chip-${tp.key}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-extrabold">
                    {active && <Check className="size-4 text-med" strokeWidth={3} />}
                    {l(tp.name)}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    {t('masteredOf', { n: mastered(tp), total })}
                    {st > 0 && (
                      <span className="inline-flex items-center gap-1 font-black text-flag-d dark:text-danger">
                        <AlertTriangle className="size-3" /> {t('stuckN', { n: st })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noTopics')}</p>
        )}
      </div>
    </div>
  );
}
