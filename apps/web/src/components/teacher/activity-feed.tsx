'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { useL } from '@/lib/hooks';
import { STATUS_VARIANT } from './helpers';
import type { ActivityItem } from './types';
import { useRelativeTime } from './use-relative-time';

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const t = useTranslations('teacher.class');
  const ts = useTranslations('common.status');
  const ago = useRelativeTime();
  const l = useL();
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t('noActivity')}</p>;
  return (
    <ul className="divide-y divide-border" data-testid="activity-feed">
      {items.slice(0, 8).map((a) => (
        <li key={a.submissionId} className="flex items-center gap-3 py-2.5">
          <Avatar name={a.studentName} src={a.avatarUrl} className="size-8 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-bold">{a.studentName}</span> <span className="text-muted-foreground">· {l(a.missionTitle)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{ago(a.at)}</p>
          </div>
          <Badge variant={STATUS_VARIANT[a.status]}>{ts(a.status)}</Badge>
        </li>
      ))}
    </ul>
  );
}
