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
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-muted-foreground">
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
      <span className="inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1.5 text-sm font-extrabold text-success" data-testid="safety-badge" data-safe="true">
        <ShieldCheck className="size-4" /> {t('passed')}
      </span>
    );
  return (
    <div className="rounded-[16px] border border-coral/40 bg-coral-soft p-4" data-testid="safety-badge" data-safe="false" role="alert">
      <p className="flex items-center gap-2 font-extrabold text-danger">
        <ShieldAlert className="size-5" /> {t('issuesTitle')}
      </p>
      <ul className="ms-7 mt-2 list-disc space-y-1 text-sm">
        {check.issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {check.saferVersion && (
        <div className="mt-3 rounded-[12px] bg-card p-3 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('saferLabel')}</p>
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
