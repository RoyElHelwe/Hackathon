'use client';

import { BookOpen, CheckCircle2, Grid3x3, HeartHandshake, Target, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { KpiCard } from '@/components/director/kpi-card';
import { PendingCallout } from '@/components/director/pending-callout';
import { SchoolCodeCard } from '@/components/director/school-code-card';
import { TopClasses } from '@/components/director/top-classes';
import { TrendChart } from '@/components/director/trend-chart';
import type { SchoolSubject } from '@/components/director/types';
import { useDirectorDashboard } from '@/components/director/use-school';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';

export default function DirectorOverviewPage() {
  const t = useTranslations('director.overview');
  const ts = useTranslations('director.subjects');
  const { data, isLoading, error, refetch, schoolId } = useDirectorDashboard();
  const subjects = useApi<SchoolSubject[]>(schoolId ? `/schools/${schoolId}/subjects` : null);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />;
  const k = data.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { school: data.school.name, city: data.school.city })}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/director/coverage">
              <Grid3x3 /> {t('coverageCta')}
            </Link>
          </Button>
        }
      />

      {subjects.data?.length === 0 && (
        <Card className="flex flex-wrap items-center gap-4 border-2 border-violet/40 bg-violet-soft p-5" data-testid="subjects-nudge">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-violet text-white">
            <BookOpen className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-extrabold leading-tight">{ts('nudgeTitle')}</h3>
            <p className="text-sm text-muted-foreground">{ts('nudgeBody')}</p>
          </div>
          <Button asChild size="sm" data-testid="subjects-nudge-cta">
            <Link href="/director/subjects">{ts('nudgeCta')}</Link>
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          testId="kpi-active"
          icon={Users}
          tone="violet"
          label={t('kpiActive')}
          value={k.activeStudentsWeek}
          percent={k.totalStudents ? (k.activeStudentsWeek / k.totalStudents) * 100 : 0}
          hint={t('kpiActiveHint', { total: k.totalStudents })}
        />
        <KpiCard testId="kpi-validated" icon={CheckCircle2} tone="mint" label={t('kpiValidated')} value={k.missionsValidated} hint={t('kpiValidatedHint', { week: k.missionsValidatedWeek })} />
        <KpiCard testId="kpi-mastery" icon={Target} tone="sky" label={t('kpiMastery')} value={k.avgMastery} suffix="%" percent={k.avgMastery} hint={t('kpiMasteryHint')} />
        <KpiCard testId="kpi-parents" icon={HeartHandshake} tone="coral" label={t('kpiParents')} value={k.parentParticipation} suffix="%" percent={k.parentParticipation} hint={t('kpiParentsHint')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={data.trend} />
        </div>
        <div className="grid gap-4">
          <PendingCallout count={k.pendingMembers} />
          <SchoolCodeCard code={data.school.schoolCode} />
        </div>
      </div>

      <TopClasses classes={data.classes} />
    </div>
  );
}
