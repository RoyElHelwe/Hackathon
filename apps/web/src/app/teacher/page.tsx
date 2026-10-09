'use client';

import { BookOpen, Download, Plus, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Arzino } from '@/components/arzino';
import { SubjectChip, subjectLabel } from '@/components/director/subject-chip';
import { ClassCard } from '@/components/teacher/class-card';
import { ReconnectBanner } from '@/components/teacher/reconnect-banner';
import { SetCourseDialog } from '@/components/teacher/set-course-dialog';
import type { CourseSummary } from '@/components/teacher/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useApi, useMe } from '@/lib/hooks';
import type { ClassSummary } from '@/lib/types';

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'greetMorning' : h < 18 ? 'greetAfternoon' : 'greetEvening';
}

export default function TeacherClassesPage() {
  const t = useTranslations('teacher.classes');
  const tc = useTranslations('teacher.courses');
  const locale = useLocale();
  const { data: me } = useMe();
  const { data: classes, isLoading, error, refetch } = useApi<ClassSummary[]>('/classes');
  const courses = useApi<CourseSummary[]>('/courses');
  // Same query the sidebar badge uses (shared cache).
  const queue = useApi<{ status: string }[]>('/teacher/review-queue');
  const toReview = queue.data?.filter((q) => q.status === 'TEACHER_REVIEW').length ?? 0;
  const totalStudents = classes?.reduce((n, c) => n + c.studentCount, 0) ?? 0;

  const courseList = courses.data ?? [];
  const grouped = courseList
    .map((course) => ({ course, sections: (classes ?? []).filter((c) => c.courseId === course.id) }))
    .filter((g) => g.sections.length);
  const known = new Set(grouped.map((g) => g.course.id));
  const unassigned = (classes ?? []).filter((c) => !c.courseId || (!courses.isLoading && !known.has(c.courseId)));

  return (
    <div>
      <PageHeader
        mood="teaching"
        eyebrow={me ? t(greetingKey()) : undefined}
        title={me?.user.name ?? ''}
        subtitle={classes?.length ? t('subtitle', { classes: classes.length, students: totalStudents }) : t('subtitleEmpty')}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/teacher/onboarding?step=import" data-testid="import-from-classroom">
                <Download /> {t('import')}
              </Link>
            </Button>
            {!!classes?.length && (
              <Button asChild variant="kidMint">
                <Link href={`/teacher/missions?classId=${classes[0].id}`}>
                  <Plus /> {t('newMission')}
                </Link>
              </Button>
            )}
          </>
        }
      />
      {classes?.some((c) => c.syncError === 'RECONNECT') && <ReconnectBanner />}

      {!!classes?.length && (
        <div className="mb-10 grid gap-5 md:grid-cols-2">
          <Link
            href={`/teacher/missions?classId=${classes[0].id}`}
            className="group flex items-center gap-5 rounded-[20px] border-2 border-dashed border-med/60 bg-med-soft p-5 transition-colors hover:border-med"
          >
            <Arzino mood="writing" size={112} />
            <div className="min-w-0">
              <p className="font-display text-[22px] font-black leading-tight text-med-ink dark:text-white">{t('heroStudioTitle')}</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{t('heroStudioBody')}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-black uppercase tracking-[0.08em] text-med-d dark:text-med">
                <Wand2 className="size-4" /> {t('newMission')}
              </span>
            </div>
          </Link>
          <Card className="flex items-center gap-5 p-5">
            <Arzino mood={toReview ? 'clipboard' : 'cool'} size={112} />
            <div className="min-w-0 flex-1">
              <p className={toReview ? 'eyebrow !text-flag-d dark:!text-danger' : 'eyebrow'}>{t('waitingEyebrow')}</p>
              <p className="mt-0.5 font-display text-[22px] font-black leading-tight">{toReview ? t('waitingTitle', { n: toReview }) : t('waitingNone')}</p>
              <Button asChild variant={toReview ? 'kid' : 'kidGhost'} size="sm" className="mt-3">
                <Link href="/teacher/review">{t('reviewNow')}</Link>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {isLoading || courses.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-[20px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !classes?.length ? (
        <div className="rounded-[20px] border-2 border-dashed border-med/50 bg-med-soft/40">
          <EmptyState
            mood="welcome"
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              <Button asChild size="lg" variant="kidMint">
                <Link href="/teacher/onboarding" data-testid="start-onboarding">
                  {t('emptyCta')}
                </Link>
              </Button>
            }
            className="py-16"
          />
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(({ course, sections }) => (
            <section key={course.id} data-testid="course-group">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-[22px] font-black tracking-tight">{tc('title', { grade: course.gradeLevel, subject: subjectLabel(course.subject.name, locale) })}</h2>
                    <SubjectChip name={course.subject.name} color={course.subject.color} locale={locale} />
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
                    {tc('sectionCount', { n: course.sectionCount })} · {tc('lessonCount', { n: course.lessonCount })}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/courses/${course.id}`} data-testid="course-lessons-link">
                    <BookOpen /> {tc('lessons')}
                  </Link>
                </Button>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {sections.map((c) => (
                  <ClassCard key={c.id} cls={c} color={course.subject.color} />
                ))}
              </div>
            </section>
          ))}
          {unassigned.length > 0 && (
            <section data-testid="unassigned-group">
              <div className="mb-4">
                <h2 className="font-display text-[22px] font-black tracking-tight">{tc('unassignedTitle')}</h2>
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{tc('unassignedBody')}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {unassigned.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2">
                    <ClassCard cls={c} />
                    <SetCourseDialog classId={c.id} initial={{ subjectId: c.subjectId, gradeLevel: c.gradeLevel, sectionLabel: c.sectionLabel }} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
