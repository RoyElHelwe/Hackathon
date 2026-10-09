'use client';

import { CalendarDays, ExternalLink, PenLine, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useApi, useL } from '@/lib/hooks';
import type { Mission } from '@/lib/types';

/** Existing drafts / published missions of a class, or of a course (its mission templates). */
export function MissionList({ classId, courseId, editingIds, onOpen }: { classId?: string; courseId?: string; editingIds: string[]; onOpen: (m: Mission) => void }) {
  const t = useTranslations('teacher.studio');
  const { data, isLoading, error, refetch } = useApi<Mission[]>(courseId ? `/missions?courseId=${courseId}` : `/missions?classId=${classId}`);
  if (isLoading) return <Skeleton className="h-40" />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  const drafts = (data ?? []).filter((m) => m.status === 'DRAFT');
  const published = (data ?? []).filter((m) => m.status === 'APPROVED');
  return (
    <Tabs defaultValue={drafts.length ? 'drafts' : 'published'}>
      <TabsList>
        <TabsTrigger value="drafts" data-testid="tab-drafts">
          {t('tabDrafts', { n: drafts.length })}
        </TabsTrigger>
        <TabsTrigger value="published" data-testid="tab-published">
          {t('tabPublished', { n: published.length })}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="drafts" className="mt-4">
        {drafts.length ? (
          <ul className="divide-y divide-border">
            {drafts.map((m) => (
              <Row key={m.id} m={m}>
                {editingIds.includes(m.id) ? (
                  <Badge variant="default">{t('inEditor')}</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onOpen(m)} data-testid="open-draft">
                    <PenLine /> {t('review')}
                  </Button>
                )}
              </Row>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('noDrafts')} body={t('noDraftsBody')} mood="sleepy" className="py-6" />
        )}
      </TabsContent>
      <TabsContent value="published" className="mt-4">
        {published.length ? (
          <ul className="divide-y divide-border">
            {published.map((m) => (
              <Row key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t('noPublished')} mood="curious" className="py-6" />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Row({ m, children }: { m: Mission; children?: React.ReactNode }) {
  const t = useTranslations('teacher.studio');
  const td = useTranslations('common.difficulty');
  const format = useFormatter();
  const l = useL();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-testid="mission-row">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{l(m.title)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {m.topic && <Badge variant="muted">{l(m.topic.name)}</Badge>}
          <Badge variant="outline">{td(m.difficulty)}</Badge>
          {m.audience === 'FAMILY' && (
            <Badge variant="sunny">
              <Users /> {t('familyMission')}
            </Badge>
          )}
          {m.classroomCourseWorkId && (
            <Badge variant="mint">
              <ExternalLink /> {t('inClassroom')}
            </Badge>
          )}
          {m.dueAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {format.dateTime(new Date(m.dueAt), { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
      {m.status === 'APPROVED' && (
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">{t('submissionsN', { n: m.submissionCount ?? 0 })}</span>
      )}
      {children}
    </li>
  );
}
