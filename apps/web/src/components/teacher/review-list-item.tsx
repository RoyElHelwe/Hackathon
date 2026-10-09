'use client';

import { CloudOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import type { Submission } from '@/lib/types';
import { FlagBadges } from './flag-badges';
import { scoreTone } from './helpers';
import { useRelativeTime } from './use-relative-time';

export function ReviewListItem({ s, active, onSelect }: { s: Submission; active: boolean; onSelect: () => void }) {
  const t = useTranslations('teacher.review');
  const l = useL();
  const ago = useRelativeTime();
  const score = s.finalScore ?? s.effectiveAiScore ?? s.aiCheck?.score ?? null;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-start gap-3 rounded-[16px] border-2 p-3 text-start transition-colors',
          active ? 'border-med/60 bg-med-soft shadow-[0_3px_0_0_var(--med)]' : 'border-border bg-card shadow-[0_3px_0_0_var(--border)] hover:bg-muted',
        )}
        aria-current={active || undefined}
        data-testid="review-item"
        data-status={s.status}
      >
        <Avatar name={s.student?.name ?? '?'} src={s.student?.avatarUrl} className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-extrabold">{s.student?.name}</p>
            {score !== null && <span className={cn('font-display text-lg font-black tabular-nums', scoreTone(score))}>{score}</span>}
          </div>
          <p className="truncate text-sm font-semibold text-muted-foreground">{l(s.mission.title)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {s.status === 'PEER_REVIEW' && <Badge variant="sky">{t('withPeer', { name: s.peer?.evaluatorFirstName ?? '' })}</Badge>}
            {s.gradeSyncPending && (
              <Badge variant="sunny" data-testid="grade-sync-pending">
                <CloudOff /> {t('syncPending')}
              </Badge>
            )}
            <FlagBadges flags={s.flags ?? []} />
            {s.submittedAt && <span className="text-xs text-muted-foreground">{ago(s.submittedAt)}</span>}
          </div>
        </div>
      </button>
    </li>
  );
}
