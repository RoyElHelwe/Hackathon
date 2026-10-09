'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { useL } from '@/lib/hooks';
import type { StuckAlert } from './types';

export function StuckAlertItem({ alert, classId, label }: { alert: StuckAlert; classId: string; label?: string }) {
  const t = useTranslations('teacher.stuck');
  const l = useL();
  return (
    <li data-testid="stuck-alert">
      {label && <p className="eyebrow mb-1">{label}</p>}
      <Link
        href={`/teacher/students/${alert.studentId}?classId=${classId}`}
        className="group flex items-center gap-3 rounded-[16px] border-2 border-flag/25 bg-card p-3 transition-colors hover:border-flag/60 hover:bg-flag-soft"
      >
        <Avatar name={alert.studentName} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-snug">{t('line', { name: alert.studentName, topic: l(alert.topicName) })}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {alert.reasons.map((r) => (
              <Badge key={r} variant="coral">
                {t(`reason.${r}`)}
              </Badge>
            ))}
          </div>
        </div>
        <ChevronRight className="rtl-flip size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export function StuckAlertList({ alerts, classId }: { alerts: StuckAlert[]; classId: string }) {
  const t = useTranslations('teacher.stuck');
  if (!alerts.length)
    return (
      <div className="flex items-center gap-3 rounded-[16px] border-2 border-cedar/30 bg-cedar-soft p-4">
        <Arzino mood="cool" size={64} />
        <div>
          <p className="font-extrabold text-cedar-ink dark:text-white">{t('noneTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('noneBody')}</p>
        </div>
      </div>
    );
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <StuckAlertItem key={`${a.studentId}-${a.topicId}`} alert={a} classId={classId} />
      ))}
    </ul>
  );
}
