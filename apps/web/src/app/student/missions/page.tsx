'use client';

import { useTranslations } from 'next-intl';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { MissionCard } from '@/components/student/mission-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useApi } from '@/lib/hooks';
import type { Mission } from '@/lib/types';

export default function MissionsPage() {
  const t = useTranslations('student');
  const { data, isLoading, error, refetch } = useApi<Mission[]>('/missions');
  const progress = useApi<{ topicId: string; state: string }[]>('/progress/me');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={() => refetch()} />;
  const list = data ?? [];
  const locked = new Set(progress.data?.filter((p) => p.state === 'LOCKED').map((p) => p.topicId));
  const active = list.filter((m) => m.mySubmission && m.mySubmission.status !== 'VALIDATED');
  const available = list.filter((m) => !m.mySubmission && !locked.has(m.topicId));
  const done = list.filter((m) => m.mySubmission?.status === 'VALIDATED');
  const section = (items: Mission[], empty: string) =>
    items.length ? (
      <div className="space-y-3">
        {items.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>
    ) : (
      <EmptyState title={empty} />
    );
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold">{t('missionsTitle')}</h1>
      <Tabs defaultValue={active.length ? 'active' : 'available'}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            {t('tabActive')} ({active.length})
          </TabsTrigger>
          <TabsTrigger value="available" className="flex-1">
            {t('tabAvailable')} ({available.length})
          </TabsTrigger>
          <TabsTrigger value="done" className="flex-1">
            {t('tabDone')} ({done.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          {section(active, t('noActive'))}
        </TabsContent>
        <TabsContent value="available" className="mt-4">
          {section(available, t('noAvailable'))}
        </TabsContent>
        <TabsContent value="done" className="mt-4">
          {section(done, t('noDone'))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
