'use client';

import { cn } from '@/lib/cn';
import { subjectLabel } from './subject-chip';

const BG: Record<string, string> = {
  violet: 'bg-violet-soft',
  sky: 'bg-sky-soft',
  mint: 'bg-mint-soft',
  green: 'bg-green-soft',
  coral: 'bg-coral-soft',
  sunny: 'bg-sunny-soft',
  pink: 'bg-coral-soft',
  slate: 'bg-muted',
};

export interface SubjectPickerOption {
  id: string;
  name: { en?: string; ar?: string };
  color?: string;
}

/** Toggle-chip multi-select for a school's subjects (used in invite, teacher edit, and onboarding join). */
export function SubjectPicker({
  options,
  value,
  onChange,
  locale,
  className,
}: {
  options: SubjectPickerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  locale: string;
  className?: string;
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="group">
      {options.map((o) => {
        const selected = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(o.id)}
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold text-foreground transition-all',
              BG[o.color ?? 'violet'] ?? BG.slate,
              selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : 'opacity-60 hover:opacity-100',
            )}
            data-testid="subject-option"
          >
            {subjectLabel(o.name, locale)}
          </button>
        );
      })}
    </div>
  );
}
