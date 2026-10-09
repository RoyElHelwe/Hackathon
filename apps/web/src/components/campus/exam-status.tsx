'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { AttemptStatus, ExamStatus } from '@/lib/campus/types';

const EXAM_TONE: Record<ExamStatus, 'default' | 'mint' | 'sunny' | 'coral' | 'sky' | 'muted'> = {
  DRAFT: 'muted',
  PREPARING: 'sunny',
  READY: 'default',
  SCHEDULED: 'sky',
  OPEN: 'mint',
  CLOSED: 'muted',
  FAILED: 'coral',
};
const ATTEMPT_TONE: Record<AttemptStatus, 'default' | 'mint' | 'sunny' | 'coral' | 'sky' | 'muted'> = {
  NOT_STARTED: 'muted',
  IN_PROGRESS: 'sky',
  GRADING: 'sunny',
  GRADED: 'default',
  RELEASED: 'mint',
  MISSED: 'coral',
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const t = useTranslations('campus.teacher.status');
  return <Badge variant={EXAM_TONE[status]} data-testid="exam-status">{t(status)}</Badge>;
}

export function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  const t = useTranslations('campus.teacher.attempt');
  return <Badge variant={ATTEMPT_TONE[status]} data-testid="attempt-status">{t(status)}</Badge>;
}
