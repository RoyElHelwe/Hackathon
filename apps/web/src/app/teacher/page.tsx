'use client';

import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState } from '@/components/app/states';
import { ClassCard } from '@/components/teacher/class-card';
import { ReconnectBanner } from '@/components/teacher/reconnect-banner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useApi, useMe } from '@/lib/hooks';
import type { ClassSummary } from '@/lib/types';

export default function TeacherClassesPage() {
  const t = useTranslations('teacher.classes');
  const { data: me } = useMe();
  const { data: classes, isLoading, error, refetch } = useApi<ClassSummary[]>('/classes');
  const totalStudents = classes?.reduce((n, c) => n + c.studentCount, 0) ?? 0;
  const firstName = me?.user.name.split(' ')[0] ?? '';

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
      {isLoading ? (
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <ClassCard key={c.id} cls={c} />
          ))}
        </div>
      )}
    </div>
  );
}
