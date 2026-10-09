'use client';

import type { SubmissionStatus } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

const VARIANT: Partial<Record<SubmissionStatus, 'mint' | 'sunny' | 'coral' | 'sky' | 'muted' | 'default'>> = {
  VALIDATED: 'mint',
  FAMILY_CONFIRM: 'sunny',
  RETRY: 'sky',
  PEER_REVIEW: 'sky',
  TEACHER_REVIEW: 'sky',
  IN_PROGRESS: 'muted',
};

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const t = useTranslations('common.status');
  return (
    <Badge variant={VARIANT[status] ?? 'default'} className={cn('shadow-[0_2px_0_rgba(0,0,0,0.08)]', className)}>
      {status === 'VALIDATED' ? '✓ ' : ''}
      {t(status)}
    </Badge>
  );
}
