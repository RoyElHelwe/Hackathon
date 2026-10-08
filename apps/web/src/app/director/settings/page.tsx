'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { SettingsForm } from '@/components/director/settings-form';
import { useToast } from '@/components/director/toast';
import type { School } from '@/components/director/types';
import { useSchoolId } from '@/components/director/use-school';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';

export default function SettingsPage() {
  const t = useTranslations('director.settings');
  const schoolId = useSchoolId();
  const { data, isLoading, error, refetch } = useApi<School>(schoolId ? `/schools/${schoolId}` : null);
  const { toast, node } = useToast();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('title')} subtitle={data ? `${data.name} · ${t('subtitle')}` : t('subtitle')} />
      {isLoading || !schoolId ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />
      ) : (
        <SettingsForm key={data.id} school={data} onToast={toast} />
      )}
      {node}
    </div>
  );
}
