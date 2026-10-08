'use client';

import { BookOpen, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState } from '@/components/app/states';
import { SubjectChip, subjectLabel } from '@/components/director/subject-chip';
import { ClassCard } from '@/components/teacher/class-card';
import { ReconnectBanner } from '@/components/teacher/reconnect-banner';
import { SetCourseDialog } from '@/components/teacher/set-course-dialog';
import type { CourseSummary } from '@/components/teacher/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useApi, useMe } from '@/lib/hooks';
import type { ClassSummary } from '@/lib/types';

export default function TeacherClassesPage() {
  const t = useTranslations('teacher.classes');
  const tc = useTranslations('teacher.courses');
  const locale = useLocale();
  const { data: me } = useMe();
  const { data: classes, isLoading, error, refetch } = useApi<ClassSummary[]>('/classes');
  const courses = useApi<CourseSummary[]>('/courses');
  const totalStudents = classes?.reduce((n, c) => n + c.studentCount, 0) ?? 0;
  const firstName = me?.user.name.split(' ')[0] ?? '';

  const courseList = courses.data ?? [];
  const grouped = courseList
    .map((course) => ({ course, sections: (classes ?? []).filter((c) => c.courseId === course.id) }))
    .filter((g) => g.sections.length);
  const known = new Set(grouped.map((g) => g.course.id));
  const unassigned = (classes ?? []).filter((c) => !c.courseId || (!courses.isLoading && !known.has(c.courseId)));

  return (
    <div>
      <PageHeader
        title={t('title', { name: firstName })}
        subtitle={classes?.length ? t('subtitle', { classes: classes.length, students: totalStudents }) : t('subtitleEmpty')}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/teacher/onboarding?step=import" data-testid="import-from-classroom">
                <Download /> {t('import')}
              </Link>
            </Button>
            {!!classes?.length && (
              <Button asChild>
                <Link href={`/teacher/missions?classId=${classes[0].id}`}>
                  <Plus /> {t('newMission')}
                </Link>
              </Button>
            )}
          </>
        }
      />
      {classes?.some((c) => c.syncError === 'RECONNECT') && <ReconnectBanner />}
      {isLoading || courses.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-[20px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !classes?.length ? (
        <div className="rounded-[20px] border border-dashed border-border bg-card">
          <EmptyState
            mood="curious"
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              <Button asChild size="lg">
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SubjectChip name={course.subject.name} color={course.subject.color} locale={locale} />
                    <h2 className="text-xl font-extrabold tracking-tight">{tc('title', { grade: course.gradeLevel, subject: subjectLabel(course.subject.name, locale) })}</h2>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
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
                  <ClassCard key={c.id} cls={c} />
                ))}
              </div>
            </section>
          ))}
          {unassigned.length > 0 && (
            <section data-testid="unassigned-group">
              <div className="mb-4">
                <h2 className="text-xl font-extrabold tracking-tight">{tc('unassignedTitle')}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{tc('unassignedBody')}</p>
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
