'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { SessionReplay } from '@/components/campus/session-replay';
import { mmss } from '@/components/campus/use-countdown';
import { Button } from '@/components/ui/button';
import type { StudySessionDetail } from '@/lib/campus/types';
import { useApi } from '@/lib/hooks';

export default function TeacherSessionReplayPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('campus');
  const q = useApi<StudySessionDetail>(`/study-sessions/${id}`, { refetchInterval: (s) => (s.state.data?.status === 'ACTIVE' ? 10_000 : false) });
  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const s = q.data;
  const names = Object.fromEntries(s.participants.map((p) => [p.userId, p.name.split(' ')[0]]));
  const dur = s.startedAt ? Math.round(((s.endedAt ? new Date(s.endedAt) : new Date()).getTime() - new Date(s.startedAt).getTime()) / 1000) : 0;
  return (
    <div className="max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/teacher/sessions">
          <ArrowLeft className="rtl-flip" /> {t('teacher.navSessions')}
        </Link>
      </Button>
      <PageHeader title={s.participants.map((p) => p.name).join(' & ')} subtitle={`${s.className}${s.topic ? ` · ${s.topic}` : ''} · ${t('study.duration', { time: mmss(dur) })} · ${t(`sessions.status.${s.status}`)}`} />
      <SessionReplay kind="STUDY" refId={s.id} events={s.events} names={names} />
    </div>
  );
}
