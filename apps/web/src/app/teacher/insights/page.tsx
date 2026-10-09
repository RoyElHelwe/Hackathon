'use client';

import { useQueries } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, Gauge, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { ClassMasteryChart } from '@/components/teacher/class-mastery-chart';
import { BAND_BAR, BAND_TEXT, band } from '@/components/teacher/helpers';
import { StatTile } from '@/components/teacher/stat-tile';
import { StuckAlertItem } from '@/components/teacher/stuck-alerts';
import type { TeacherDashboard } from '@/components/teacher/types';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useApi, useL } from '@/lib/hooks';
import type { ClassSummary } from '@/lib/types';

export default function InsightsPage() {
  const t = useTranslations('teacher.insights');
  const l = useL();
  const classes = useApi<ClassSummary[]>('/classes');
  const dashboards = useQueries({
    queries: (classes.data ?? []).map((c) => ({
      queryKey: [`/dashboards/teacher/${c.id}`],
      queryFn: () => api<TeacherDashboard>(`/dashboards/teacher/${c.id}`),
    })),
  });
  const loaded = dashboards.map((d) => d.data).filter((d): d is TeacherDashboard => !!d);
  const loadingDash = dashboards.some((d) => d.isLoading);
  const dashError = dashboards.find((d) => d.error)?.error;

  const totals = useMemo(() => {
    const students = loaded.reduce((n, d) => n + d.stats.students, 0);
    const weighted = loaded.reduce((n, d) => n + d.stats.avgMastery * d.stats.students, 0);
    return {
      students,
      avgMastery: students ? Math.round(weighted / students) : 0,
      validated: loaded.reduce((n, d) => n + d.stats.validatedThisWeek, 0),
      pending: loaded.reduce((n, d) => n + d.stats.pendingReviews, 0),
      stuck: loaded.reduce((n, d) => n + d.stats.stuckCount, 0),
    };
  }, [loaded]);

  /** Topics with the lowest share of students who mastered them (excluding topics nobody can start yet). */
  const struggling = useMemo(() => {
    const rows: { key: string; name: string; className: string; pct: number; inProgress: number }[] = [];
    for (const d of loaded) {
      for (const tp of d.topics) {
        const cells = d.cells.filter((c) => c.topicId === tp.id);
        if (!cells.length || cells.every((c) => c.state === 'LOCKED')) continue;
        const mastered = cells.filter((c) => c.state === 'MASTERED').length;
        const inProgress = cells.filter((c) => c.state === 'IN_PROGRESS').length;
        rows.push({ key: `${d.class.id}-${tp.id}`, name: l(tp.name), className: d.class.name, pct: Math.round((mastered / d.students.length) * 100), inProgress });
      }
    }
    return rows.sort((a, b) => b.inProgress - a.inProgress || a.pct - b.pct).slice(0, 6);
  }, [loaded, l]);

  if (classes.isLoading) return <PageSkeleton />;
  if (classes.error) return <ErrorState message={classes.error.message} onRetry={() => classes.refetch()} />;
  if (!classes.data?.length) return <EmptyState title={t('noClasses')} body={t('noClassesBody')} mood="curious" />;

  const stuck = loaded.flatMap((d) => d.stuck.map((s) => ({ ...s, classId: d.class.id, className: d.class.name })));

  return (
    <div>
      <PageHeader mood="laser-focus" eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle', { n: classes.data.length })} />
      {dashError && <ErrorState message={dashError.message} onRetry={() => dashboards.forEach((d) => d.refetch())} className="py-4" />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={Users} label={t('students')} value={loadingDash ? '…' : totals.students} tone="med" />
        <StatTile icon={Gauge} label={t('avgMastery')} value={loadingDash ? '…' : `${totals.avgMastery}%`} tone="cedar" />
        <StatTile icon={CheckCircle2} label={t('validated')} value={loadingDash ? '…' : totals.validated} hint={t('thisWeek')} tone="cedar" />
        <StatTile icon={ClipboardCheck} label={t('pending')} value={loadingDash ? '…' : totals.pending} tone="flame" href="/teacher/review" />
        <StatTile icon={AlertTriangle} label={t('stuck')} value={loadingDash ? '…' : totals.stuck} tone="flag" alert={!loadingDash && totals.stuck > 0} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('chartTitle')}</CardTitle>
            <CardDescription>{t('chartBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDash ? <Skeleton className="h-64" /> : <ClassMasteryChart rows={loaded.map((d) => ({ name: d.class.name, mastery: d.stats.avgMastery }))} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('topicsTitle')}</CardTitle>
            <CardDescription>{t('topicsBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDash ? (
              <Skeleton className="h-64" />
            ) : struggling.length ? (
              <ul className="space-y-4" data-testid="topic-attention">
                {struggling.map((r) => (
                  <li key={r.key}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-extrabold">
                        {r.name} <span className="font-semibold text-muted-foreground">· {r.className}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.inProgress > 0 && <Badge variant="sky">{t('inProgressN', { n: r.inProgress })}</Badge>}
                        <span className={`w-11 text-end font-black tabular-nums ${BAND_TEXT[band(r.pct)]}`}>{r.pct}%</span>
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={r.pct} className="h-3.5" barClassName={BAND_BAR[band(r.pct)]} />
                      <span className="absolute inset-y-[-3px] start-1/2 border-s-2 border-dashed border-lock-d" aria-hidden />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noTopics')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('classesTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y-2 divide-border">
              {classes.data.map((c) => {
                const d = loaded.find((x) => x.class.id === c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/teacher/classes/${c.id}`} className="group flex items-center gap-4 py-3" data-testid="insight-class">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-black group-hover:text-med-d dark:group-hover:text-med">{c.name}</p>
                        <p className="text-xs font-semibold text-muted-foreground">{t('classLine', { students: c.studentCount, missions: c.missionCount })}</p>
                      </div>
                      {d ? (
                        <div className="hidden w-48 sm:block">
                          <div className="mb-1 flex justify-between text-xs font-bold text-muted-foreground">
                            <span>{t('avgMastery')}</span>
                            <span className={`font-black tabular-nums ${BAND_TEXT[band(d.stats.avgMastery)]}`}>{d.stats.avgMastery}%</span>
                          </div>
                          <Progress value={d.stats.avgMastery} className="h-3" barClassName={BAND_BAR[band(d.stats.avgMastery)]} />
                        </div>
                      ) : (
                        <Skeleton className="h-6 w-48" />
                      )}
                      <div className="hidden w-44 justify-end gap-1.5 md:flex">
                        {!!d?.stats.pendingReviews && <Badge variant="sky">{t('toReviewN', { n: d.stats.pendingReviews })}</Badge>}
                        {!!d?.stats.stuckCount && <Badge variant="coral">{t('stuckN', { n: d.stats.stuckCount })}</Badge>}
                      </div>
                      <ChevronRight className="rtl-flip size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <Card className={stuck.length ? 'self-start border-flag/40' : 'self-start'}>
          <CardHeader className="flex-row items-center gap-3">
            <Arzino mood={stuck.length ? 'flop-cry' : 'cool'} size={84} />
            <CardTitle className="text-xl">{t('stuckTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDash ? (
              <Skeleton className="h-24" />
            ) : stuck.length ? (
              <ul className="space-y-2">
                {stuck.map((s) => (
                  <StuckAlertItem key={`${s.classId}-${s.studentId}-${s.topicId}`} alert={s} classId={s.classId} label={s.className} />
                ))}
              </ul>
            ) : (
              <p className="rounded-[14px] border-2 border-cedar/30 bg-cedar-soft px-4 py-3 text-sm font-extrabold text-cedar-ink dark:text-white">{t('noStuck')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
