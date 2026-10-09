'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Arzino } from '@/components/arzino';
import { Dialog, DialogTitle, SheetContent, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { NotificationItem } from '@/lib/types';
import type { I18nText } from '@tajriba/shared';

/** Tile color per notification kind: wins cedar, people blue, alerts red, family/summary flame. */
const TONE: Record<string, string> = {
  LEVEL_UP: 'bg-cedar-soft',
  BADGE: 'bg-cedar-soft',
  SUBMISSION_VALIDATED: 'bg-cedar-soft',
  EXAM_RESULT_RELEASED: 'bg-cedar-soft',
  PEER_REVIEW_ASSIGNED: 'bg-med-soft',
  STUDY_INVITE: 'bg-med-soft',
  STUDY_ACCEPTED: 'bg-med-soft',
  MISSION_PUBLISHED: 'bg-med-soft',
  EXAM_SCHEDULED: 'bg-med-soft',
  EXAM_OPEN: 'bg-med-soft',
  STUCK_ALERT: 'bg-flag-soft',
  MEMBER_PENDING: 'bg-flag-soft',
  SUMMARY_READY: 'bg-flame-soft',
};

const ICON: Record<string, string> = {
  LEVEL_UP: '⬆️',
  BADGE: '🏅',
  PEER_REVIEW_ASSIGNED: '🧐',
  STUCK_ALERT: '🌲',
  MISSION_PUBLISHED: '🚀',
  SUMMARY_READY: '📬',
  MEMBER_PENDING: '🙋',
  SUBMISSION_VALIDATED: '✅',
  STUDY_INVITE: '📚',
  STUDY_ACCEPTED: '🤝',
  EXAM_SCHEDULED: '🗓️',
  EXAM_OPEN: '🎙️',
  EXAM_RESULT_RELEASED: '🏆',
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
    case 'STUDY_INVITE':
    case 'STUDY_ACCEPTED':
      return `/student/study/${p.sessionId}`;
    case 'EXAM_SCHEDULED':
    case 'EXAM_OPEN':
      return '/student/campus';
    case 'EXAM_RESULT_RELEASED':
      return p.studentId ? `/parent?child=${p.studentId}` : `/student/exams/${p.attemptId}`;
  }
}

export function NotificationsBell({ className }: { className?: string }) {
  const t = useTranslations('common');
  const l = useL();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [open, setOpen] = useState(false);
  const { data } = useApi<NotificationItem[]>('/notifications', { refetchInterval: 20_000 });
  const invalidate = useInvalidate();
  const unread = data?.filter((n) => !n.readAt).length ?? 0;

  const text = (n: NotificationItem) => {
    const p = n.payload as Record<string, unknown>;
    const title = p.title ? l(p.title as I18nText) : '';
    return t(`notif.${n.type}`, {
      name: String(p.name ?? p.studentName ?? p.fromName ?? p.byName ?? ''),
      title,
      level: String(p.level ?? ''),
      badge: p.name && typeof p.name === 'object' ? l(p.name as I18nText) : '',
      topic: String(p.topicName ?? ''),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            'relative inline-flex size-11 items-center justify-center rounded-[14px] border-2 border-border bg-card shadow-[0_3px_0_var(--border)] transition-[transform,box-shadow] hover:bg-muted active:translate-y-[3px] active:shadow-none',
            className,
          )}
          aria-label={t('notifications')}
          data-testid="notifications-bell"
        >
          <Bell className={cn('size-5', unread > 0 && 'fill-flame/20 text-flame-d dark:text-warning')} />
          {unread > 0 && (
            <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-flag px-1 text-[11px] font-black text-white">{unread}</span>
          )}
        </button>
      </DialogTrigger>
      <SheetContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <DialogTitle className="font-display text-2xl">{t('notifications')}</DialogTitle>
          {unread > 0 && (
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-black uppercase tracking-wider text-med-ink hover:bg-med-soft dark:text-med"
              onClick={() => api('/notifications/read-all', { method: 'POST' }).then(() => invalidate('/notifications'))}
            >
              <CheckCheck className="size-4" /> {t('markAllRead')}
            </button>
          )}
        </div>
        {!data?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Arzino mood="cool" size={130} />
            <p className="font-display text-lg">{t('noNotifications')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((n) => {
              const href = linkFor(n);
              const inner = (
                <div className={cn('flex items-center gap-3 rounded-[16px] border-2 p-3 text-start transition-colors hover:bg-muted', n.readAt ? 'border-transparent' : 'border-border bg-card shadow-[0_3px_0_var(--border)]')}>
                  <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-[12px] text-xl', TONE[n.type] ?? 'bg-muted')} aria-hidden>
                    {ICON[n.type] ?? '🔔'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', n.readAt ? 'font-semibold text-muted-foreground' : 'font-extrabold')}>{text(n)}</p>
                    <p className="text-xs font-bold text-muted-foreground">{format.relativeTime(new Date(n.createdAt), now)}</p>
                  </div>
                  {!n.readAt && <span className="size-2.5 shrink-0 rounded-full bg-med" aria-hidden />}
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
