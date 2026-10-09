'use client';

import { useTranslations } from 'next-intl';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { PageHero } from '@/components/director/page-hero';
import { FamilyMissionCard } from '@/components/parent/family-mission-card';
import type { FamilyMission } from '@/components/parent/types';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';

const waiting = (m: FamilyMission) => m.childSubmissions.some((s) => s.status === 'FAMILY_CONFIRM' && !s.confirmation);

export default function FamilyMissionsPage() {
  const t = useTranslations('parent.family');
  const { data, isLoading, error, refetch } = useApi<FamilyMission[]>('/families/missions');
  // Missions waiting for the parent come first.
  const list = [...(data ?? [])].sort((a, b) => Number(waiting(b)) - Number(waiting(a)));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHero mood="streak-buddy" accent="flame" eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />
      ) : !list.length ? (
        <EmptyState mood="bored-waiting" title={t('empty')} body={t('emptyBody')} />
      ) : (
        <div className="space-y-5">
          {list.map((m) => (
            <FamilyMissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}
    </div>
  );
}
