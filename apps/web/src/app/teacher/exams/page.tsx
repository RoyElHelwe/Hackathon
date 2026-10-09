'use client';

import { CalendarClock, Mic, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Arzino } from '@/components/arzino';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { ExamStatusBadge } from '@/components/campus/exam-status';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import type { ExamListItem } from '@/lib/campus/types';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';

export default function TeacherExamsPage() {
  const t = useTranslations('campus.teacher');
  const format = useFormatter();
  const exams = useApi<ExamListItem[]>('/exams', { refetchInterval: (q) => (q.state.data?.some((e) => e.status === 'PREPARING' || e.status === 'OPEN') ? 5000 : false) });
  const when = (d: string) => format.dateTime(new Date(d), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="flex items-center gap-4">
        <Arzino mood="teaching" size={96} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
            actions={
              <Button asChild variant="kidMint" data-testid="new-exam">
                <Link href="/teacher/exams/new">
                  <Plus /> {t('new')}
                </Link>
              </Button>
            }
          />
        </div>
      </div>
      {exams.isLoading ? (
        <PageSkeleton />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : !exams.data?.length ? (
        <Card className="py-4">
          <EmptyState mood="writing" title={t('empty')} className="py-10" />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {exams.data.map((e) => {
            const done = e.counts.GRADING + e.counts.GRADED + e.counts.RELEASED;
            const pct = e.counts.total ? (done / e.counts.total) * 100 : 0;
            return (
              <li key={e.id}>
                <Link href={`/teacher/exams/${e.id}`} data-testid="exam-row" className="block rounded-[20px] focus-visible:outline-offset-4">
                  <Card className={cn('chunky-hover space-y-3 p-4', e.status === 'OPEN' && 'border-med shadow-[0_4px_0_0_var(--med-d)]')}>
                    <div className="flex items-start gap-3">
                      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-[14px] [&_svg]:size-6', e.status === 'OPEN' ? 'bg-med text-white' : 'bg-med-soft text-med-ink dark:text-white')}>
                        <Mic />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-black">{e.title}</p>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {e.className} · {e.durationMin} min
                        </p>
                      </div>
                      <ExamStatusBadge status={e.status} />
                    </div>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <CalendarClock className="size-4" /> {when(e.opensAt)} → {when(e.closesAt)}
                    </p>
                    {e.counts.total > 0 && (
                      <div className="flex items-center gap-3">
                        <Progress value={pct} className="h-3" barClassName={pct >= 70 ? 'bg-cedar' : 'bg-med'} />
                        <span className="shrink-0 text-xs font-black">{t('progress', { done, total: e.counts.total })}</span>
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
