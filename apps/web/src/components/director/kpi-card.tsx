import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

const TONES = {
  violet: { chip: 'bg-violet-soft text-primary dark:text-white', bar: 'bg-primary' },
  mint: { chip: 'bg-mint-soft text-success', bar: 'bg-mint' },
  sky: { chip: 'bg-sky-soft text-sky dark:text-white', bar: 'bg-sky' },
  coral: { chip: 'bg-coral-soft text-danger', bar: 'bg-coral' },
} as const;

/** A single headline number with context. `percent` adds a thin meter. */
export function KpiCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  tone = 'violet',
  percent,
  testId,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  percent?: number;
  testId: string;
}) {
  const s = TONES[tone];
  return (
    <Card className="flex flex-col gap-3 p-5" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        <span className={cn('flex size-9 items-center justify-center rounded-[12px]', s.chip)}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="font-display text-4xl font-extrabold tabular-nums leading-none" data-testid={`${testId}-value`}>
        {value}
        {suffix && <span className="ms-0.5 text-2xl text-muted-foreground">{suffix}</span>}
      </p>
      {percent != null && <Progress value={percent} className="h-1.5" barClassName={s.bar} />}
      {hint && <p className="text-xs font-semibold text-muted-foreground">{hint}</p>}
    </Card>
  );
}
