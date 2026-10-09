'use client';

import { CheckCircle2, Grid3x3, HeartHandshake, Target, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { Arzino } from '@/components/arzino';
import { KpiCard } from '@/components/director/kpi-card';
import { PageHero } from '@/components/director/page-hero';
import { PendingCallout } from '@/components/director/pending-callout';
import { SchoolCodeCard } from '@/components/director/school-code-card';
import { masteryTone } from '@/components/director/tone';
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
    <div className="space-y-5">
      <PageHero
        mood="lebanese-pride"
        size={128}
        eyebrow={t('title')}
        title={data.school.name}
        subtitle={t('heroSubtitle', { city: data.school.city, classes: data.classes.length, students: k.totalStudents })}
        actions={
          <Button asChild variant="kidGhost">
            <Link href="/director/coverage">
              <Grid3x3 /> {t('coverageCta')}
            </Link>
          </Button>
        }
      />

      {subjects.data?.length === 0 && (
        <Card className="flex flex-wrap items-center gap-4 p-4 pe-5" data-testid="subjects-nudge">
          <Arzino mood="writing" size={80} animate={false} className="-my-2" />
          <div className="min-w-0 flex-1 basis-48">
            <h3 className="text-lg font-black leading-tight">{ts('nudgeTitle')}</h3>
            <p className="text-sm font-semibold text-muted-foreground">{ts('nudgeBody')}</p>
          </div>
          <Button asChild variant="kidCoral" data-testid="subjects-nudge-cta">
            <Link href="/director/subjects">{ts('nudgeCta')}</Link>
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          testId="kpi-active"
          icon={Users}
          tone="cedar"
          label={t('kpiActive')}
          value={k.activeStudentsWeek}
          percent={k.totalStudents ? (k.activeStudentsWeek / k.totalStudents) * 100 : 0}
          hint={t('kpiActiveHint', { total: k.totalStudents })}
        />
        <KpiCard testId="kpi-validated" icon={CheckCircle2} tone="med" label={t('kpiValidated')} value={k.missionsValidated} hint={t('kpiValidatedHint', { week: k.missionsValidatedWeek })} mood="trophy" />
        <KpiCard testId="kpi-mastery" icon={Target} tone={masteryTone(k.avgMastery)} label={t('kpiMastery')} value={k.avgMastery} suffix="%" percent={k.avgMastery} hint={t('kpiMasteryHint')} />
        <KpiCard testId="kpi-parents" icon={HeartHandshake} tone="flame" label={t('kpiParents')} value={k.parentParticipation} suffix="%" percent={k.parentParticipation} hint={t('kpiParentsHint')} />
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
