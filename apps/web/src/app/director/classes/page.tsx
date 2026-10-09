'use client';

import { useTranslations } from 'next-intl';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { ClassesTable } from '@/components/director/classes-table';
import { PageHero } from '@/components/director/page-hero';
import { useDirectorDashboard } from '@/components/director/use-school';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api';

export default function ClassesPage() {
  const t = useTranslations('director.classes');
  const { data, isLoading, error, refetch } = useDirectorDashboard();

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />;
  const students = data.classes.reduce((s, c) => s + c.students, 0);

  return (
    <div>
      <PageHero mood="lebanese-pride" eyebrow={data.school.name} title={t('title')} subtitle={t('subtitle', { n: data.classes.length, students })} />
      <Card className="overflow-hidden">
        {data.classes.length ? <ClassesTable classes={data.classes} /> : <EmptyState mood="bored-waiting" title={t('empty')} body={t('emptyBody')} />}
      </Card>
    </div>
  );
}
