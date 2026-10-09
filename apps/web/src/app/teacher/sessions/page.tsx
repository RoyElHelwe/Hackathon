'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import type { TeacherStudySession } from '@/lib/campus/types';
import type { ClassSummary } from '@/lib/types';
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
      {sessions.isLoading ? (
        <PageSkeleton />
      ) : sessions.error ? (
        <ErrorState onRetry={() => sessions.refetch()} />
      ) : !sessions.data?.length ? (
        <EmptyState mood="sleepy" title={t('teacher.sessions.empty')} className="py-14" />
      ) : (
        <ul className="space-y-2" data-testid="teacher-sessions">
          {sessions.data.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <span className="text-2xl" aria-hidden>
                  {s.status === 'ACTIVE' ? '🟢' : '🎧'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{s.participants.map((p) => p.name).join(' & ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.startedAt ? format.dateTime(new Date(s.startedAt), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''} · {t('teacher.sessions.duration', { min: Math.max(1, Math.round(s.durationSec / 60)) })} ·{' '}
                    {t('teacher.sessions.recordings', { n: s.recordings })}
                  </p>
                </div>
                <Badge variant={s.status === 'ACTIVE' ? 'mint' : 'muted'}>{t(`sessions.status.${s.status}`)}</Badge>
                <Button asChild size="sm" variant="outline">
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
