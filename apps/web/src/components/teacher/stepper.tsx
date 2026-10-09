import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Step indicator (1 — 2 — 3). `vertical` + `onDark` for the colored onboarding panel. */
export function Stepper({ steps, current, vertical = false, onDark = false }: { steps: string[]; current: number; vertical?: boolean; onDark?: boolean }) {
  return (
    <ol className={cn('flex gap-2', vertical ? 'flex-col gap-3' : 'items-center')} aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cn('flex items-center gap-3', !vertical && 'flex-1 last:flex-none')} aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full font-display text-base font-black transition-colors',
                done && (onDark ? 'bg-white text-med-d' : 'bg-cedar text-white shadow-[0_3px_0_var(--cedar-d)]'),
                active && (onDark ? 'bg-white text-med-d ring-4 ring-white/35' : 'bg-med text-white shadow-[0_3px_0_var(--med-d)] ring-4 ring-med/20'),
                !done && !active && (onDark ? 'bg-white/20 text-white' : 'bg-lock text-muted-foreground'),
              )}
            >
              {done ? <Check className="size-5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                'font-display text-sm font-black uppercase tracking-[0.06em]',
                !vertical && 'hidden sm:block',
                onDark ? (active || done ? 'text-white' : 'text-white/70') : active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {!vertical && i < steps.length - 1 && <span className={cn('mx-1 h-1 flex-1 rounded-full', done ? 'bg-cedar' : 'bg-lock')} />}
          </li>
        );
      })}
    </ol>
  );
}
