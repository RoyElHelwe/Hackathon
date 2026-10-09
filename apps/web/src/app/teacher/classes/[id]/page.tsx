'use client';

import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Gauge, Link2, Users, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { use } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { SubjectChip, subjectLabel } from '@/components/director/subject-chip';
import { ActivityFeed } from '@/components/teacher/activity-feed';
import { GroupSessionDialog } from '@/components/teacher/group-session-dialog';
import { Heatmap } from '@/components/teacher/heatmap';
import { LeaderboardCard } from '@/components/teacher/leaderboard-card';
import { ReconnectBanner } from '@/components/teacher/reconnect-banner';
import { SetCourseDialog } from '@/components/teacher/set-course-dialog';
import { StatTile } from '@/components/teacher/stat-tile';
import { StudentsTable } from '@/components/teacher/students-table';
import { StuckAlertList } from '@/components/teacher/stuck-alerts';
import { SyncButton } from '@/components/teacher/sync-button';
import type { ClassStudent, TeacherDashboard } from '@/components/teacher/types';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useApi } from '@/lib/hooks';
import { useRelativeTime } from '@/components/teacher/use-relative-time';

export default function ClassOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('teacher.class');
  const tc = useTranslations('teacher.courses');
  const locale = useLocale();
  const ago = useRelativeTime();
  const { data, isLoading, error, refetch } = useApi<TeacherDashboard>(`/dashboards/teacher/${id}`);
  const students = useApi<ClassStudent[]>(`/classes/${id}/students`);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} />;
  const { stats } = data;

  return (
    <div>
      <Link href="/teacher" className="mb-4 inline-flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-[0.09em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="rtl-flip size-4" /> {t('back')}
      </Link>
      <PageHeader
        mood="teaching"
        eyebrow={t('eyebrow')}
        title={data.class.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {data.class.course ? (
              <>
              <Link
                href={`/teacher/courses/${data.class.course.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-card py-0.5 pe-2.5 ps-0.5 text-xs font-extrabold text-foreground hover:border-med/60"
                data-testid="class-course-link"
              >
                <SubjectChip name={data.class.course.subject.name} color={data.class.course.subject.color} locale={locale} />
                {tc('title', { grade: data.class.course.gradeLevel, subject: subjectLabel(data.class.course.subject.name, locale) })}
                {data.class.sectionLabel && <span className="text-muted-foreground">· {tc('sectionShort', { label: data.class.sectionLabel })}</span>}
              </Link>
              <SetCourseDialog
                classId={id}
                label={tc('changeCourse')}
                initial={{ subjectId: data.class.course.subject.id, gradeLevel: data.class.course.gradeLevel, sectionLabel: data.class.sectionLabel }}
              />
              </>
            ) : (
              <SetCourseDialog
                classId={id}
                initial={{ subjectId: data.class.subjectId, gradeLevel: data.class.gradeLevel, sectionLabel: data.class.sectionLabel }}
              />
            )}
            {data.class.classroomCourseId && (
              <Badge variant="sky">
                <Link2 /> {t('classroomLinked')}
              </Badge>
            )}
            <span className="text-sm">
              {data.class.lastSyncedAt ? t('synced', { when: ago(data.class.lastSyncedAt) }) : t('neverSynced')}
            </span>
          </span>
        }
        actions={
          <>
            {data.class.classroomCourseId && <SyncButton classId={id} />}
            <Button asChild variant="kidMint">
              <Link href={`/teacher/missions?classId=${id}`} data-testid="generate-mission-link">
                <Wand2 /> {t('generate')}
              </Link>
            </Button>
          </>
        }
      />
      {data.class.syncError === 'RECONNECT' && <ReconnectBanner />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="class-stats">
        <StatTile icon={Users} label={t('statStudents')} value={stats.students} tone="med" />
        <StatTile icon={Gauge} label={t('statMastery')} value={`${stats.avgMastery}%`} tone="cedar" />
        <StatTile icon={CheckCircle2} label={t('statValidated')} value={stats.validatedThisWeek} hint={t('statValidatedHint')} tone="cedar" />
        <StatTile icon={ClipboardCheck} label={t('statPending')} value={stats.pendingReviews} tone="flame" href="/teacher/review" />
        <StatTile icon={AlertTriangle} label={t('statStuck')} value={stats.stuckCount} tone="flag" alert={stats.stuckCount > 0} />
      </div>

      {data.stuck.length > 0 && (
        <section className="mt-6 grid items-center gap-5 rounded-[20px] border-2 border-flag/40 bg-flag-soft p-5 md:grid-cols-[auto_1fr] md:p-6" data-testid="stuck-panel">
          <Arzino mood="flop-cry" size={150} className="mx-auto" />
          <div className="min-w-0">
            <p className="eyebrow !text-flag-d dark:!text-danger">{t('stuckEyebrow')}</p>
            <h2 className="font-display text-[24px] font-black leading-tight">{t('stuckHeadline', { n: data.stuck.length })}</h2>
            <p className="mb-4 mt-1 text-sm font-semibold text-muted-foreground">{t('groupHint')}</p>
            <StuckAlertList alerts={data.stuck} classId={id} />
            <div className="mt-4">
              <GroupSessionDialog classId={id} />
            </div>
          </div>
        </section>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-xl">{t('heatmapTitle')}</CardTitle>
          <CardDescription>{t('heatmapBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap data={data} classId={id} />
        </CardContent>
      </Card>

      <div className={data.stuck.length ? 'mt-6 grid gap-6 lg:grid-cols-2' : 'mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3'}>
        {!data.stuck.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t('stuckTitle')}</CardTitle>
              <CardDescription>{t('stuckBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <StuckAlertList alerts={data.stuck} classId={id} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t('activityTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={data.recent} />
          </CardContent>
        </Card>
        <LeaderboardCard classId={id} enabled={!!data.class.settings?.leaderboardEnabled} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-xl">{t('studentsTitle', { n: stats.students })}</CardTitle>
          <CardDescription>{t('studentsBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          {students.isLoading ? (
            <Skeleton className="h-40" />
          ) : students.error ? (
            <ErrorState message={students.error.message} onRetry={() => students.refetch()} />
          ) : (
            <StudentsTable students={students.data ?? []} classId={id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
