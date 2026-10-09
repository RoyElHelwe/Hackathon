'use client';

import { Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { ExamStatusBadge } from '@/components/campus/exam-status';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import type { ExamListItem } from '@/lib/campus/types';
import { useApi } from '@/lib/hooks';

export default function TeacherExamsPage() {
  const t = useTranslations('campus.teacher');
  const format = useFormatter();
  const exams = useApi<ExamListItem[]>('/exams', { refetchInterval: (q) => (q.state.data?.some((e) => e.status === 'PREPARING' || e.status === 'OPEN') ? 5000 : false) });
  const when = (d: string) => format.dateTime(new Date(d), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild data-testid="new-exam">
            <Link href="/teacher/exams/new">
              <Plus /> {t('new')}
            </Link>
          </Button>
        }
      />
      {exams.isLoading ? (
        <PageSkeleton />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : !exams.data?.length ? (
        <EmptyState mood="curious" title={t('empty')} className="py-14" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {exams.data.map((e) => {
            const done = e.counts.GRADING + e.counts.GRADED + e.counts.RELEASED;
            return (
              <li key={e.id}>
                <Link href={`/teacher/exams/${e.id}`} data-testid="exam-row">
                  <Card className="space-y-2 p-4 transition-colors hover:border-primary">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-extrabold">{e.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {e.className} · {e.durationMin} min
                        </p>
                      </div>
                      <ExamStatusBadge status={e.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{when(e.opensAt)} → {when(e.closesAt)}</p>
                    {e.counts.total > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={(done / e.counts.total) * 100} className="h-2" />
                        <span className="shrink-0 text-xs font-bold">{t('progress', { done, total: e.counts.total })}</span>
                      </div>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
