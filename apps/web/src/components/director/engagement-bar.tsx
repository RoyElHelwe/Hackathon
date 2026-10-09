import { cn } from '@/lib/cn';
import { masteryTone, TONE_BAR, TONE_TEXT } from './tone';

/** Compact glossy percentage bar + number, colored by the 3-color rule (red < 50, blue 50–69, cedar ≥ 70). */
export function EngagementBar({ value, className }: { value: number; className?: string }) {
  const tone = masteryTone(value);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-3 w-full min-w-16 overflow-hidden rounded-full bg-lock" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('bar-gloss h-full rounded-full', TONE_BAR[tone])} style={{ width: `${Math.max(value > 0 ? 4 : 0, Math.min(100, value))}%` }} />
      </div>
      <span className={cn('w-11 shrink-0 text-end text-sm font-black tabular-nums', TONE_TEXT[tone])}>{value}%</span>
    </div>
  );
}
