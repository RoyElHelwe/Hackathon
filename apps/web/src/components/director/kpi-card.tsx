import type { LucideIcon } from 'lucide-react';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

const TONES = {
  cedar: { chip: 'bg-cedar-soft text-cedar-d dark:text-success', bar: 'bg-cedar', num: 'text-cedar-ink dark:text-success' },
  med: { chip: 'bg-med-soft text-med-d dark:text-ring', bar: 'bg-med', num: 'text-med-ink dark:text-ring' },
  flag: { chip: 'bg-flag-soft text-flag-d dark:text-danger', bar: 'bg-flag', num: 'text-flag-d dark:text-danger' },
  flame: { chip: 'bg-flame-soft text-flame-d dark:text-warning', bar: 'bg-flame', num: 'text-flame-d dark:text-warning' },
} as const;

export type KpiTone = keyof typeof TONES;

/** A big headline number with a short label. `percent` adds a glossy meter; `mood` puts a small Arzino in the corner. */
export function KpiCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  tone = 'cedar',
  percent,
  mood,
  testId,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: KpiTone;
  percent?: number;
  mood?: ArzinoMood;
  testId: string;
}) {
  const s = TONES[tone];
  return (
    <Card className="relative flex flex-col gap-2 overflow-hidden p-5" data-testid={testId}>
      {mood ? (
        <Arzino mood={mood} size={72} animate={false} className="absolute -bottom-1 end-1 opacity-95" />
      ) : (
        <span className={cn('absolute end-4 top-4 flex size-10 items-center justify-center rounded-[12px]', s.chip)}>
          <Icon className="size-5" />
        </span>
      )}
      <p className={cn('font-display text-[44px] font-black leading-none tabular-nums', s.num)} data-testid={`${testId}-value`}>
        {value}
        {suffix && <span className="ms-0.5 text-2xl">{suffix}</span>}
      </p>
      <p className="pe-12 font-extrabold leading-tight">{label}</p>
      {hint && <p className={cn('text-xs font-bold text-muted-foreground', mood && 'pe-16')}>{hint}</p>}
      {percent != null && <Progress value={percent} className={cn('mt-auto h-3', mood && 'w-[calc(100%-72px)]')} barClassName={s.bar} />}
    </Card>
  );
}
