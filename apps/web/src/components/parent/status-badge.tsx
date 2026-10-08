'use client';

import type { SubmissionStatus } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

const VARIANT: Partial<Record<SubmissionStatus, 'mint' | 'sunny' | 'coral' | 'sky' | 'muted' | 'default'>> = {
  VALIDATED: 'mint',
  FAMILY_CONFIRM: 'coral',
  RETRY: 'sunny',
  PEER_REVIEW: 'sky',
  TEACHER_REVIEW: 'sky',
  IN_PROGRESS: 'muted',
};

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const t = useTranslations('common.status');
  return (
    <Badge variant={VARIANT[status] ?? 'default'} className={className}>
      {status === 'VALIDATED' ? '✓ ' : ''}
      {t(status)}
    </Badge>
  );
}
