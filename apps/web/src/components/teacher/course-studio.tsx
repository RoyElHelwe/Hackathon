'use client';

import type { I18nText } from '@tajriba/shared';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { subjectLabel } from '@/components/director/subject-chip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { Mission } from '@/lib/types';
import { MissionDraftCard } from './mission-draft-card';
import { MissionList } from './mission-list';
import type { CourseSummary } from './types';

/** Mission studio for a course: review/edit/approve the templates Bousla wrote from gamified lessons. */
export function CourseStudio({ courseId }: { courseId: string }) {
  const t = useTranslations('teacher.studio');
  const tc = useTranslations('teacher.courses');
  const locale = useLocale();
  const l = useL();
  const invalidate = useInvalidate();
  const course = useApi<CourseSummary>(`/courses/${courseId}`);
  const missions = useApi<Mission[]>(`/missions?courseId=${courseId}`);
  // Local edits / approvals made on this page (an approved card stays visible with its "published" banner).
  const [overrides, setOverrides] = useState<Record<string, Mission>>({});
  const [removed, setRemoved] = useState<string[]>([]);

  const onChange = useCallback(
    (m: Mission) => {
      setOverrides((o) => ({ ...o, [m.id]: m }));
      if (m.status === 'APPROVED') void invalidate(`/missions?courseId=${courseId}`, `/courses/${courseId}/lessons`);
    },
    [courseId, invalidate],
  );
  const onRemove = useCallback(
    (id: string) => {
      setRemoved((r) => [...r, id]);
      void invalidate(`/missions?courseId=${courseId}`, `/courses/${courseId}/lessons`);
    },
    [courseId, invalidate],
  );

  const drafts = useMemo(
    () => (missions.data ?? []).filter((m) => !removed.includes(m.id) && (m.status === 'DRAFT' || overrides[m.id])).map((m) => overrides[m.id] ?? m),
    [missions.data, overrides, removed],
  );
  // Group by skill (one skill per gamified lesson), keeping the API order.
  const groups = useMemo(() => {
    const out: { topicId: string; name: I18nText | null; items: Mission[] }[] = [];
    for (const m of drafts) {
      let g = out.find((x) => x.topicId === m.topicId);
      if (!g) out.push((g = { topicId: m.topicId, name: m.topic?.name ?? null, items: [] }));
      g.items.push(m);
    }
    return out;
  }, [drafts]);

  if (course.isLoading || missions.isLoading) return <PageSkeleton />;
  if (course.error || !course.data) return <ErrorState message={course.error?.message} onRetry={() => course.refetch()} />;
  if (missions.error) return <ErrorState message={missions.error.message} onRetry={() => missions.refetch()} />;
  const c = course.data;
  const courseName = tc('title', { grade: c.gradeLevel, subject: subjectLabel(c.subject.name, locale) });
  const target = t('allSections', { n: c.sectionCount, course: courseName });
  const classroomLinked = c.sections.some((s) => s.classroomLinked);
  const pending = drafts.filter((m) => m.status === 'DRAFT').length;

  return (
    <div>
      <Link href={`/teacher/courses/${courseId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="rtl-flip size-4" /> {t('backToCourse')}
      </Link>
      <PageHeader title={t('courseTitle', { course: courseName })} subtitle={t('courseSubtitle')} />

      <section className="space-y-5" data-testid="course-drafts">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <Sparkles className="size-5 text-primary" /> {t('courseDraftsTitle', { n: pending })}
        </h2>
        {!drafts.length ? (
          <Card>
            <EmptyState title={t('noDrafts')} body={t('courseNoDraftsBody')} mood="sleepy" className="py-10" />
          </Card>
        ) : (
          groups.map((g) => (
            <div key={g.topicId} className="space-y-4">
              {g.name && <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('skillGroup', { name: l(g.name) })}</h3>}
              {g.items.map((m) => (
                <MissionDraftCard
                  key={m.id}
                  mission={m}
                  index={drafts.indexOf(m)}
                  className={target}
                  classroomLinked={classroomLinked}
                  courseMode
                  onChange={onChange}
                  onRemove={onRemove}
                />
              ))}
            </div>
          ))
        )}
      </section>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('courseLibraryTitle', { course: courseName })}</CardTitle>
          <CardDescription>{t('libraryBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <MissionList courseId={courseId} editingIds={drafts.map((d) => d.id)} onOpen={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </CardContent>
      </Card>
    </div>
  );
}
