'use client';

import { CloudCheck } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi, useL } from '@/lib/hooks';
import { STATUS_VARIANT, scoreTone } from './helpers';
import { PhotoGallery } from './photo-gallery';
import type { StudentHistoryItem } from './types';

export function HistoryList({ studentId }: { studentId: string }) {
  const t = useTranslations('teacher.student');
  const ts = useTranslations('common.status');
  const format = useFormatter();
  const l = useL();
  const { data, isLoading, error, refetch } = useApi<StudentHistoryItem[]>(`/submissions?studentId=${studentId}`);
  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState title={t('noHistory')} body={t('noHistoryBody')} mood="sleepy" className="py-6" />;
  return (
    <ul className="divide-y-2 divide-border" data-testid="mission-history">
      {data.map((s) => {
        const score = s.finalScore ?? s.aiScore;
        const when = s.validatedAt ?? s.submittedAt ?? s.startedAt;
        return (
          <li key={s.id} className="flex items-center gap-3 py-3" data-testid="history-item">
            <PhotoGallery ids={s.photoUploadIds.slice(0, 1)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{l(s.mission.title)}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{l(s.mission.topicName)}</span>
                <span>· {format.dateTime(new Date(when), { day: 'numeric', month: 'short' })}</span>
                {s.attempt > 1 && <span>· {t('attempt', { n: s.attempt })}</span>}
                {s.status === 'VALIDATED' && s.gradeSynced && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CloudCheck className="size-3.5" /> {t('gradeSynced')}
                  </span>
                )}
              </p>
            </div>
            {score !== null && <span className={cn('w-12 text-end font-display text-xl font-black tabular-nums', scoreTone(score))}>{score}</span>}
            <Badge variant={STATUS_VARIANT[s.status]} className="hidden sm:inline-flex">
              {s.status === 'RETRY' ? t('needsAnotherTry') : ts(s.status)}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
