'use client';

import { ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { BouslaSays } from '@/components/bousla';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { topicEmoji } from '@/components/student/subject-style';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { useApi, useL } from '@/lib/hooks';
import type { I18nText } from '@tajriba/shared';

interface Assigned {
  id: string;
  status: 'ASSIGNED' | 'DONE' | 'EXPIRED';
  dueAt: string;
  score: number | null;
  mission: { id: string; title: I18nText; topicKey: string };
  submitter: { firstName: string; avatarUrl: string | null };
}

export default function ReviewsPage() {
  const t = useTranslations('student');
  const format = useFormatter();
  const l = useL();
  const { data, isLoading, error, refetch } = useApi<Assigned[]>('/peer-reviews/assigned');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  const todo = data?.filter((r) => r.status === 'ASSIGNED') ?? [];
  const done = data?.filter((r) => r.status === 'DONE') ?? [];
  const row = (r: Assigned) => (
    <Link key={r.id} href={`/student/reviews/${r.id}`} className="flex items-center gap-3 rounded-[20px] border-2 border-border bg-card p-4 hover:border-primary/50" data-testid="review-card">
      <div className="relative">
        <Avatar name={r.submitter.firstName} src={r.submitter.avatarUrl} className="size-14 text-lg" />
        <span className="absolute -bottom-1 -end-1 text-2xl" aria-hidden>
          {topicEmoji(r.mission.topicKey)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold leading-tight">{l(r.mission.title)}</p>
        <p className="text-sm text-muted-foreground">{t('from', { name: r.submitter.firstName })}</p>
        {r.status === 'ASSIGNED' ? <Badge variant="sunny">⏰ {t('dueIn', { time: format.relativeTime(new Date(r.dueAt)) })}</Badge> : <Badge variant="mint">✓ {r.score}/100</Badge>}
      </div>
      <ChevronRight className="rtl-flip size-6 text-muted-foreground" />
    </Link>
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">{t('reviewsTitle')}</h1>
        <p className="text-muted-foreground">{t('reviewsSub')}</p>
      </div>
      {todo.length === 0 && done.length === 0 && <BouslaSays mood="sleepy">{t('noReviews')}</BouslaSays>}
      {todo.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-extrabold">{t('toReview')}</h2>
          {todo.map(row)}
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-extrabold text-muted-foreground">{t('reviewed')}</h2>
          {done.map(row)}
        </section>
      )}
    </div>
  );
}
