'use client';

import { Bell } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog, DialogTitle, SheetContent, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { NotificationItem } from '@/lib/types';
import type { I18nText } from '@tajriba/shared';

const ICON: Record<string, string> = {
  LEVEL_UP: '⬆️',
  BADGE: '🏅',
  PEER_REVIEW_ASSIGNED: '🧐',
  STUCK_ALERT: '🧭',
  MISSION_PUBLISHED: '🚀',
  SUMMARY_READY: '📬',
  MEMBER_PENDING: '🙋',
  SUBMISSION_VALIDATED: '✅',
};

function linkFor(n: NotificationItem): string | undefined {
  const p = n.payload as Record<string, string>;
  switch (n.type) {
    case 'PEER_REVIEW_ASSIGNED':
      return `/student/reviews/${p.peerEvaluationId}`;
    case 'SUBMISSION_VALIDATED':
      return `/student/submissions/${p.submissionId}`;
    case 'MISSION_PUBLISHED':
      return p.familyConfirm ? '/parent/family' : `/student/missions/${p.missionId}`;
    case 'STUCK_ALERT':
      return `/teacher/classes/${p.classId}`;
    case 'MEMBER_PENDING':
      return '/director/members';
    case 'SUMMARY_READY':
      return '/parent';
  }
}

export function NotificationsBell({ className }: { className?: string }) {
  const t = useTranslations('common');
  const l = useL();
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const { data } = useApi<NotificationItem[]>('/notifications', { refetchInterval: 20_000 });
  const invalidate = useInvalidate();
  const unread = data?.filter((n) => !n.readAt).length ?? 0;

  const text = (n: NotificationItem) => {
    const p = n.payload as Record<string, unknown>;
    const title = p.title ? l(p.title as I18nText) : '';
    return t(`notif.${n.type}`, {
      name: String(p.name ?? p.studentName ?? ''),
      title,
      level: String(p.level ?? ''),
      badge: p.name && typeof p.name === 'object' ? l(p.name as I18nText) : '',
      topic: String(p.topicName ?? ''),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={cn('relative inline-flex size-11 items-center justify-center rounded-full border-2 border-border bg-card hover:bg-muted', className)} aria-label={t('notifications')} data-testid="notifications-bell">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-coral px-1 text-xs font-extrabold text-white">{unread}</span>
          )}
        </button>
      </DialogTrigger>
      <SheetContent>
        <div className="mb-3 flex items-center justify-between">
          <DialogTitle>{t('notifications')}</DialogTitle>
          {unread > 0 && (
            <button className="text-sm font-bold text-primary" onClick={() => api('/notifications/read-all', { method: 'POST' }).then(() => invalidate('/notifications'))}>
              {t('markAllRead')}
            </button>
          )}
        </div>
        {!data?.length ? (
          <p className="py-8 text-center text-muted-foreground">{t('noNotifications')}</p>
        ) : (
          <ul className="space-y-2">
            {data.map((n) => {
              const href = linkFor(n);
              const inner = (
                <div className={cn('flex gap-3 rounded-[16px] p-3', n.readAt ? 'bg-transparent' : 'bg-violet-soft/60')}>
                  <span className="text-2xl" aria-hidden>
                    {ICON[n.type] ?? '🔔'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{text(n)}</p>
                    <p className="text-xs text-muted-foreground">{format.relativeTime(new Date(n.createdAt))}</p>
                  </div>
                </div>
              );
              const markRead = () => !n.readAt && api(`/notifications/${n.id}/read`, { method: 'POST' }).then(() => invalidate('/notifications'));
              return (
                <li key={n.id}>
                  {href ? (
                    <Link href={href} onClick={() => { markRead(); setOpen(false); }}>
                      {inner}
                    </Link>
                  ) : (
                    <button className="w-full text-start" onClick={markRead}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Dialog>
  );
}
