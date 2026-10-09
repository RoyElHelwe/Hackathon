'use client';

import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { SafetyResult } from './types';

interface Props {
  check: SafetyResult | null;
  checking: boolean;
  onUseSafer?: () => void;
  onRecheck?: () => void;
  busy?: boolean;
}

/** Green "passed" pill, or the list of issues with a "Use safer version" fix. */
export function SafetyBadge({ check, checking, onUseSafer, onRecheck, busy }: Props) {
  const t = useTranslations('teacher.safety');
  if (checking || !check)
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="safety-badge" data-safe="pending">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-muted px-3 py-1.5 text-sm font-extrabold text-muted-foreground">
          {checking ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <ShieldAlert className="size-4" />}
          {checking ? t('checking') : t('notChecked')}
        </span>
        {!checking && onRecheck && (
          <Button size="sm" variant="ghost" onClick={onRecheck}>
            <RefreshCw /> {t('run')}
          </Button>
        )}
      </div>
    );
  if (check.safe)
    return (
      <span className="inline-flex items-center gap-2 self-start rounded-full border-2 border-cedar/40 bg-cedar-soft px-3 py-1.5 text-sm font-extrabold text-cedar-d dark:text-success" data-testid="safety-badge" data-safe="true">
        <ShieldCheck className="size-4" /> {t('passed')}
      </span>
    );
  return (
    <div className="rounded-[16px] border-2 border-flag/40 bg-flag-soft p-4" data-testid="safety-badge" data-safe="false" role="alert">
      <p className="flex items-center gap-2 font-extrabold text-flag-d dark:text-danger">
        <ShieldAlert className="size-5" /> {t('issuesTitle')}
      </p>
      <ul className="ms-7 mt-2 list-disc space-y-1 text-sm">
        {check.issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {check.saferVersion && (
        <div className="mt-3 rounded-[12px] border-2 border-border bg-card p-3 text-sm">
          <p className="eyebrow mb-1">{t('saferLabel')}</p>
          <p>{check.saferVersion}</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {check.saferVersion && onUseSafer && (
          <Button size="sm" variant="mint" onClick={onUseSafer} loading={busy} data-testid="use-safer-version">
            <ShieldCheck /> {t('useSafer')}
          </Button>
        )}
        {onRecheck && (
          <Button size="sm" variant="ghost" onClick={onRecheck} disabled={busy}>
            <RefreshCw /> {t('recheck')}
          </Button>
        )}
      </div>
    </div>
  );
}
