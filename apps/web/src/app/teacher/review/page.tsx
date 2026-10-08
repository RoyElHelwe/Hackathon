'use client';

import { ChevronDown, CloudOff, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState } from '@/components/app/states';
import { ReviewDetail } from '@/components/teacher/review-detail';
import { ReviewListItem } from '@/components/teacher/review-list-item';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';
import type { ClassSummary, Submission } from '@/lib/types';

const BASE = '/teacher/review-queue';

export default function ReviewQueuePage() {
  const t = useTranslations('teacher.review');
  const invalidate = useInvalidate();
  const classes = useApi<ClassSummary[]>('/classes');
  const [classId, setClassId] = useState('');
  const path = classId ? `${BASE}?classId=${classId}` : BASE;
  const { data, isLoading, error, refetch } = useApi<Submission[]>(path);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peerOpen, setPeerOpen] = useState(false);

  const groups = useMemo(() => {
    const list = data ?? [];
    const flagged = (s: Submission) => (s.flags?.length ? 1 : 0);
    const needs = list.filter((s) => s.status === 'TEACHER_REVIEW' || (s.status !== 'VALIDATED' && s.status !== 'PEER_REVIEW' && s.flags?.includes('fairness_gap')));
    needs.sort((a, b) => flagged(b) - flagged(a));
    const peer = list.filter((s) => s.status === 'PEER_REVIEW');
    const sync = list.filter((s) => s.status === 'VALIDATED' && s.gradeSyncPending);
    return { needs, peer, sync };
  }, [data]);

  const all = [...groups.needs, ...groups.peer, ...groups.sync];
  const selected = all.find((s) => s.id === selectedId) ?? groups.needs[0] ?? null;

  const onDone = async (u: Submission) => {
    const idx = groups.needs.findIndex((s) => s.id === u.id);
    const next = groups.needs[idx + 1] ?? groups.needs[idx - 1];
    setSelectedId(next && next.id !== u.id ? next.id : null);
    await invalidate(path, BASE);
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={data ? t('subtitle', { n: groups.needs.length }) : undefined}
        actions={
          classes.data && classes.data.length > 1 ? (
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-56" aria-label={t('filterClass')} data-testid="review-class-filter">
              <option value="">{t('allClasses')}</option>
              {classes.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-[520px]" />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !all.length ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card">
          <EmptyState mood="cheering" title={t('emptyTitle')} body={t('emptyBody')} className="py-16" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-24">
            <ListSection title={t('needsReview', { n: groups.needs.length })}>
              {groups.needs.length ? (
                groups.needs.map((s) => <ReviewListItem key={s.id} s={s} active={selected?.id === s.id} onSelect={() => setSelectedId(s.id)} />)
              ) : (
                <li className="rounded-[14px] bg-mint-soft px-3 py-3 text-sm font-semibold text-success">{t('nothingNeedsYou')}</li>
              )}
            </ListSection>
            {groups.peer.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setPeerOpen((o) => !o)}
                  className="mb-2 flex w-full items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  aria-expanded={peerOpen}
                  data-testid="toggle-peer"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" /> {t('withPeers', { n: groups.peer.length })}
                  </span>
                  <ChevronDown className={cn('size-4 transition-transform', peerOpen && 'rotate-180')} />
                </button>
                {peerOpen && (
                  <ul className="space-y-2">
                    {groups.peer.map((s) => (
                      <ReviewListItem key={s.id} s={s} active={selected?.id === s.id} onSelect={() => setSelectedId(s.id)} />
                    ))}
                  </ul>
                )}
              </div>
            )}
            {groups.sync.length > 0 && (
              <ListSection title={t('syncSection', { n: groups.sync.length })} icon={<CloudOff className="size-4" />}>
                {groups.sync.map((s) => (
                  <ReviewListItem key={s.id} s={s} active={selected?.id === s.id} onSelect={() => setSelectedId(s.id)} />
                ))}
              </ListSection>
            )}
          </aside>
          <div className="min-w-0">
            {selected ? (
              <ReviewDetail key={selected.id} s={selected} onDone={onDone} />
            ) : (
              <div className="rounded-[20px] border border-dashed border-border bg-card">
                <EmptyState mood="happy" title={t('pickOne')} className="py-16" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
