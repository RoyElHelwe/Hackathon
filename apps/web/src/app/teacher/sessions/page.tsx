'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Arzino } from '@/components/arzino';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import type { TeacherStudySession } from '@/lib/campus/types';
import type { ClassSummary } from '@/lib/types';
import { cn } from '@/lib/cn';
import { useApi } from '@/lib/hooks';

export default function TeacherSessionsPage() {
  const t = useTranslations('campus');
  const format = useFormatter();
  const classes = useApi<ClassSummary[]>('/classes');
  const [classId, setClassId] = useState('');
  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0].id);
  }, [classes.data, classId]);
  const sessions = useApi<TeacherStudySession[]>(classId ? `/classes/${classId}/study-sessions` : null, { refetchInterval: 15_000 });

  if (classes.isLoading) return <PageSkeleton />;
  if (classes.error) return <ErrorState onRetry={() => classes.refetch()} />;

  return (
    <div>
      <div className="flex items-center gap-4">
        <Arzino mood="streak-buddy" size={88} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={t('teacher.sessions.title')}
            subtitle={t('teacher.sessions.subtitle')}
            actions={
              <Select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class" className="w-48">
                {classes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            }
          />
        </div>
      </div>
      {sessions.isLoading ? (
        <PageSkeleton />
      ) : sessions.error ? (
        <ErrorState onRetry={() => sessions.refetch()} />
      ) : !sessions.data?.length ? (
        <Card>
          <EmptyState mood="bored-waiting" title={t('teacher.sessions.empty')} className="py-14" />
        </Card>
      ) : (
        <ul className="space-y-3" data-testid="teacher-sessions">
          {sessions.data.map((s) => (
            <li key={s.id}>
              <Card className={cn('flex flex-wrap items-center gap-3 p-4', s.status === 'ACTIVE' && 'border-cedar shadow-[0_4px_0_0_var(--cedar-d)]')}>
                <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-[14px] text-2xl', s.status === 'ACTIVE' ? 'bg-cedar-soft' : 'bg-med-soft')} aria-hidden>
                  {s.status === 'ACTIVE' ? '🟢' : '🎧'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-black">{s.participants.map((p) => p.name).join(' & ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.startedAt ? format.dateTime(new Date(s.startedAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''} · {t('teacher.sessions.duration', { min: Math.max(1, Math.round(s.durationSec / 60)) })} ·{' '}
                    {t('teacher.sessions.recordings', { n: s.recordings })}
                  </p>
                </div>
                <Badge variant={s.status === 'ACTIVE' ? 'mint' : 'muted'}>{t(`sessions.status.${s.status}`)}</Badge>
                <Button asChild size="sm" variant="kidMint">
                  <Link href={`/teacher/sessions/${s.id}`}>{t('teacher.sessions.replay')}</Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
