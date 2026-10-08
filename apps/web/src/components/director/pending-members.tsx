'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useApi, useInvalidate } from '@/lib/hooks';
import { dashboardPath } from './use-school';
import type { Member } from './types';

export const membersPath = (schoolId: string, status: 'PENDING' | 'APPROVED') => `/schools/${schoolId}/members?status=${status}`;

/** Pending approvals with optimistic approve / reject. */
export function PendingMembers({ schoolId, onToast }: { schoolId: string; onToast: (text: string, tone?: 'success' | 'error') => void }) {
  const t = useTranslations('director.members');
  const path = membersPath(schoolId, 'PENDING');
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { data, isLoading, error, refetch } = useApi<Member[]>(path);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (m: Member, action: 'approve' | 'reject') => {
    setBusy(m.id);
    const prev = qc.getQueryData<Member[]>([path]);
    qc.setQueryData<Member[]>([path], (list) => list?.filter((x) => x.id !== m.id));
    try {
      await api(`/memberships/${m.id}/${action}`, { method: 'POST' });
      onToast(t(action === 'approve' ? 'approved' : 'rejected', { name: m.user.name }));
      void invalidate(membersPath(schoolId, 'APPROVED'), dashboardPath(schoolId), path);
    } catch (e) {
      qc.setQueryData([path], prev);
      onToast(e instanceof ApiError ? e.message : t('error'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card data-testid="pending-members">
      <CardHeader className="flex-row items-center gap-2">
        <CardTitle>{t('pending')}</CardTitle>
        {!!data?.length && <Badge variant="coral">{data.length}</Badge>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : error ? (
          <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} className="py-4" />
        ) : !data?.length ? (
          <p className="rounded-[14px] bg-muted/60 px-4 py-5 text-center font-semibold text-muted-foreground" data-testid="no-pending">
            {t('noPending')}
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {data.map((m) => (
                <motion.li key={m.id} layout exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
                  <PendingRow m={m} busy={busy === m.id} onApprove={() => act(m, 'approve')} onReject={() => act(m, 'reject')} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PendingRow({ m, busy, onApprove, onReject }: { m: Member; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const t = useTranslations('director.members');
  const tr = useTranslations('common.roles');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[16px] border-2 border-sunny/60 bg-sunny-soft/50 p-3" data-testid="pending-member">
      <Avatar name={m.user.name} src={m.user.avatarUrl} className="size-11" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-extrabold">
          {m.user.name} <Badge variant="default">{tr(m.role)}</Badge>
        </p>
        <p className="truncate text-sm text-muted-foreground" dir="ltr">
          {m.user.email}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> {t('requested', { date: format.relativeTime(new Date(m.createdAt), now) })}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReject} disabled={busy} data-testid="reject-member">
          <X /> {t('reject')}
        </Button>
        <Button variant="mint" size="sm" onClick={onApprove} disabled={busy} data-testid="approve-member">
          <Check /> {t('approve')}
        </Button>
      </div>
    </div>
  );
}
