'use client';

import { Mic } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import type { ChildExam } from '@/lib/campus/types';
import { useApi } from '@/lib/hooks';

/** Released AI-interview exam results of a child (nothing shows before the teacher approves). */
export function ChildExams({ studentId }: { studentId: string }) {
  const t = useTranslations('campus.parent');
  const format = useFormatter();
  const exams = useApi<ChildExam[]>(`/exams/child/${studentId}`);
  if (!exams.data?.length) return null;
  return (
    <Card className="mt-5 space-y-3 p-5" data-testid="child-exams">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Mic className="size-5 text-sky" /> {t('examsTitle')}
      </h2>
      <ul className="space-y-3">
        {exams.data.map((e) => (
          <li key={e.attemptId} className="rounded-[14px] bg-muted/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{e.title}</p>
              <span className="text-lg font-extrabold text-primary">{e.score != null ? t('score', { score: e.score }) : '–'}</span>
            </div>
            {e.finishedAt && <p className="text-xs text-muted-foreground">{format.dateTime(new Date(e.finishedAt), { day: 'numeric', month: 'short' })}</p>}
            {e.teacherComment && <p className="mt-1 text-sm">💬 {e.teacherComment}</p>}
            {e.feedback && <p className="mt-1 text-sm text-muted-foreground">{e.feedback}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
