'use client';

import { ErrorState, PageSkeleton } from '@/components/app/states';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { ChildHero } from './child-hero';
import { FamilyCallout } from './family-callout';
import { ProgressWords } from './progress-words';
import { SkillPath } from './skill-path';
import { firstName, type ParentDashboard } from './types';
import { WeeklySummary } from './weekly-summary';
import { WorkGallery } from './work-gallery';

/** Everything a parent needs about one child, mobile-first. */
export function ChildDashboard({ studentId }: { studentId: string }) {
  const { data, isLoading, error, refetch } = useApi<ParentDashboard>(`/dashboards/parent/${studentId}`);
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />;
  const waitingFamily = data.recentWork.some((w) => w.status === 'FAMILY_CONFIRM');

  return (
    <div className="space-y-5">
      <ChildHero data={data} />
      {waitingFamily && <FamilyCallout childName={firstName(data.child.name)} />}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <WeeklySummary studentId={studentId} />
          <WorkGallery items={data.recentWork} />
        </div>
        <div className="space-y-5 lg:col-span-2">
          <ProgressWords data={data} />
          <SkillPath studentId={studentId} />
        </div>
      </div>
    </div>
  );
}
