import { cn } from '@/lib/cn';

/** Compact percentage bar + number. Mint ≥ 60, sunny ≥ 30, coral below. */
export function EngagementBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 60 ? 'bg-mint' : value >= 30 ? 'bg-sunny' : 'bg-coral';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(value > 0 ? 3 : 0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-10 shrink-0 text-end text-sm font-bold tabular-nums">{value}%</span>
    </div>
  );
}
