'use client';

import { ChevronRight } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Arzino } from '@/components/arzino';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
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
  const now = useNow({ updateInterval: 60_000 });
  const l = useL();
  const { data, isLoading, error, refetch } = useApi<Assigned[]>('/peer-reviews/assigned');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  const todo = data?.filter((r) => r.status === 'ASSIGNED') ?? [];
  const done = data?.filter((r) => r.status === 'DONE') ?? [];
  const row = (r: Assigned) => (
    <Link key={r.id} href={`/student/reviews/${r.id}`} className="chunky chunky-hover flex items-center gap-3 rounded-[20px] p-3.5" data-testid="review-card">
      <div className="relative shrink-0">
        <Avatar name={r.submitter.firstName} src={r.submitter.avatarUrl} className="size-14 text-lg" />
        <span className="absolute -bottom-1.5 -end-1.5 flex size-8 items-center justify-center rounded-full border-2 border-card bg-card text-lg shadow-sm" aria-hidden>
          {topicEmoji(r.mission.topicKey)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-black leading-tight">{l(r.mission.title)}</p>
        <p className="text-sm font-bold text-muted-foreground">{t('from', { name: r.submitter.firstName })}</p>
        <div className="mt-1">
          {r.status === 'ASSIGNED' ? (
            <Badge variant="sunny">⏰ {t('dueIn', { time: format.relativeTime(new Date(r.dueAt), now) })}</Badge>
          ) : (
            <Badge variant={(r.score ?? 0) >= 70 ? 'mint' : (r.score ?? 0) >= 50 ? 'sky' : 'coral'}>✓ {r.score}/100</Badge>
          )}
        </div>
      </div>
      {r.status === 'ASSIGNED' ? (
        <span className="kid-press hidden h-11 shrink-0 items-center rounded-[14px] bg-cedar px-4 text-sm font-black uppercase tracking-[0.08em] text-white [--press:var(--cedar-d)] sm:inline-flex">{t('review')}</span>
      ) : (
        <ChevronRight className="rtl-flip size-6 shrink-0 text-muted-foreground" />
      )}
    </Link>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Arzino mood="clipboard" size={110} />
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-black leading-tight">{t('reviewsTitle')}</h1>
          <p className="font-bold text-muted-foreground">{t('reviewsSub')}</p>
        </div>
      </div>
      {todo.length === 0 && done.length === 0 && <EmptyState mood="bored-waiting" title={t('noReviews')} className="chunky rounded-[24px]" />}
      {todo.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow">{t('toReview')}</h2>
          {todo.map(row)}
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow">{t('reviewed')}</h2>
          {done.map(row)}
        </section>
      )}
    </div>
  );
}
