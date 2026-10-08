import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const TONES = {
  violet: 'bg-violet-soft text-primary dark:text-white',
  mint: 'bg-mint-soft text-success',
  sunny: 'bg-sunny-soft text-warning',
  coral: 'bg-coral-soft text-danger',
  sky: 'bg-sky-soft text-sky dark:text-white',
} as const;

export interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: keyof typeof TONES;
  href?: string;
  testId?: string;
}

/** Compact KPI tile used on class overview and insights. */
export function StatTile({ icon: Icon, label, value, hint, tone = 'violet', href, testId }: StatTileProps) {
  const body = (
    <div
      className={cn(
        'flex h-full items-center gap-3 rounded-[20px] border border-border bg-card p-4 transition-colors',
        href && 'hover:border-primary/40 hover:bg-muted/40',
      )}
      data-testid={testId}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-[14px]', TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
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
