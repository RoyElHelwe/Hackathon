'use client';

import { AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useL } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { SUBJECT_DOT } from './helpers';
import type { DashTopic, Subject, TeacherDashboard } from './types';

interface Props {
  subjects: Subject[];
  dashboard: TeacherDashboard;
  subjectKey: string | null;
  topicId: string | null;
  onSubject: (k: string) => void;
  onTopic: (id: string) => void;
}

/** Subject chips, then topic chips with a mastery hint for the selected class. */
export function TopicPicker({ subjects, dashboard, subjectKey, topicId, onSubject, onTopic }: Props) {
  const t = useTranslations('teacher.studio');
  const l = useL();
  const withTopics = subjects.filter((s) => dashboard.topics.some((tp) => tp.subjectKey === s.key));
  const topics = dashboard.topics.filter((tp) => tp.subjectKey === subjectKey);
  const total = dashboard.students.length;

  const mastered = (tp: DashTopic) => dashboard.cells.filter((c) => c.topicId === tp.id && c.state === 'MASTERED').length;
  const stuck = (tp: DashTopic) => dashboard.stuck.filter((s) => s.topicId === tp.id).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-bold">{t('subject')}</p>
        <div className="flex flex-wrap gap-2">
          {withTopics.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSubject(s.key)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold transition-colors',
                subjectKey === s.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40',
              )}
              aria-pressed={subjectKey === s.key}
              data-testid={`subject-chip-${s.key}`}
            >
              <span className={cn('size-2.5 rounded-full', SUBJECT_DOT[s.color] ?? 'bg-violet', subjectKey === s.key && 'ring-2 ring-white/70')} />
              {l(s.name)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">{t('topic')}</p>
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
                    'flex min-h-14 flex-col items-start justify-center rounded-[16px] border-2 px-4 py-2 text-start transition-colors',
                    active ? 'border-primary bg-violet-soft' : 'border-border bg-card hover:border-primary/40',
                  )}
                  aria-pressed={active}
                  data-testid={`topic-chip-${tp.key}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-extrabold">
                    {active && <Check className="size-4 text-primary" />}
                    {l(tp.name)}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {t('masteredOf', { n: mastered(tp), total })}
                    {st > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-danger">
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
