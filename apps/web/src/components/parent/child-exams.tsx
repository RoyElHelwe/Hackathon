'use client';

import { MessageCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { masteryTone, TONE_TEXT } from '@/components/director/tone';
import { Card } from '@/components/ui/card';
import type { ChildExam } from '@/lib/campus/types';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';

/** Released AI-interview exam results of a child (nothing shows before the teacher approves). */
export function ChildExams({ studentId }: { studentId: string }) {
  const t = useTranslations('campus.parent');
  const format = useFormatter();
  const exams = useApi<ChildExam[]>(`/exams/child/${studentId}`);
  if (!exams.data?.length) return null;
  return (
    <Card className="mt-5 space-y-3 p-5" data-testid="child-exams">
      <h2 className="flex items-center gap-3 text-xl font-black">
        <Arzino mood="clipboard" size={56} animate={false} className="-my-2" /> {t('examsTitle')}
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {exams.data.map((e) => (
          <li key={e.attemptId} className="rounded-[16px] border-2 border-border p-4 shadow-[0_3px_0_var(--border)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black leading-tight">{e.title}</p>
                {e.finishedAt && <p className="text-xs font-bold text-muted-foreground">{format.dateTime(new Date(e.finishedAt), { day: 'numeric', month: 'short' })}</p>}
              </div>
              <span className={cn('shrink-0 font-display text-2xl font-black tabular-nums', e.score != null ? TONE_TEXT[masteryTone(e.score)] : 'text-muted-foreground')}>
                {e.score != null ? t('score', { score: e.score }) : '–'}
              </span>
            </div>
            {e.teacherComment && (
              <p className="mt-2 flex items-start gap-2 rounded-[12px] bg-med-soft px-3 py-2 text-sm font-semibold">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-med" /> {e.teacherComment}
              </p>
            )}
            {e.feedback && <p className="mt-2 text-sm font-semibold text-muted-foreground">{e.feedback}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
