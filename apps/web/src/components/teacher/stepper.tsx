import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Horizontal step indicator (1 — 2 — 3). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition-colors',
                done && 'bg-mint text-ink',
                active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                !done && !active && 'bg-muted text-muted-foreground',
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn('hidden text-sm font-bold sm:block', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <span className={cn('mx-1 h-0.5 flex-1 rounded-full', done ? 'bg-mint' : 'bg-border')} />}
          </li>
        );
      })}
    </ol>
  );
}
