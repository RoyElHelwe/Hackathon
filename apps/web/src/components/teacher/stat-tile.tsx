import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const TONES = {
  cedar: 'bg-cedar-soft text-cedar-d dark:text-success',
  med: 'bg-med-soft text-med-d dark:text-med',
  flag: 'bg-flag-soft text-flag-d dark:text-danger',
  flame: 'bg-flame-soft text-flame-d dark:text-warning',
  ink: 'bg-muted text-foreground',
} as const;

export interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: keyof typeof TONES;
  href?: string;
  testId?: string;
  /** Paint the number red (e.g. stuck students > 0). */
  alert?: boolean;
}

/** Big-number KPI tile used on class overview and insights. */
export function StatTile({ icon: Icon, label, value, hint, tone = 'ink', href, testId, alert }: StatTileProps) {
  const body = (
    <div
      className={cn('flex h-full flex-col gap-1 rounded-[20px] border-2 border-border bg-card p-4 shadow-[0_4px_0_0_var(--border)]', href && 'chunky-hover')}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'font-display text-[32px] font-black leading-none tabular-nums tracking-tight',
            alert ? 'text-flag-d dark:text-danger' : 'text-foreground',
          )}
        >
          {value}
        </p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[12px]', TONES[tone])}>
          <Icon className="size-[18px]" strokeWidth={2.5} />
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-extrabold">{label}</p>
      {hint && <p className="-mt-0.5 truncate text-xs font-semibold text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[20px]">
      {body}
    </Link>
  ) : (
    body
  );
}
