'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { SubjectIcon } from '@/components/app/subject-icon';
import { CoverageLegend, CoverageMatrix } from '@/components/director/coverage-matrix';
import { useDirectorDashboard } from '@/components/director/use-school';
import { SUBJECT_SOFT } from '@/components/teacher/helpers';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';

/** Director → Coverage: one grid per course of the school (sections × the course's skills). */
export default function CoveragePage() {
  const t = useTranslations('director.coverage');
  const l = useL();
  const { data, isLoading, error, refetch } = useDirectorDashboard();

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />;
  const courses = [...data.coverage].sort((a, b) => a.gradeLevel - b.gradeLevel || l(a.subject.name).localeCompare(l(b.subject.name)));

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {courses.length === 0 ? (
        <Card>
          <EmptyState title={t('noCourses')} body={t('noCoursesBody')} />
        </Card>
      ) : (
        <div className="space-y-5" data-testid="coverage-matrix">
          <CoverageLegend />
          {courses.map((c) => (
            <Card key={c.courseId} className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('flex size-9 items-center justify-center rounded-[12px]', SUBJECT_SOFT[c.subject.color] ?? 'bg-violet-soft')}>
                  <SubjectIcon icon={c.subject.icon} className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold leading-tight">
                    {t('courseTitle', { grade: c.gradeLevel, subject: l(c.subject.name) })}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t('courseMeta', { sections: c.sections.length, skills: c.topics.length })}</p>
                </div>
              </div>
              {c.topics.length ? (
                <CoverageMatrix course={c} />
              ) : (
                <p className="rounded-[14px] border-2 border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground" data-testid="coverage-empty">
                  {t('empty')}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
