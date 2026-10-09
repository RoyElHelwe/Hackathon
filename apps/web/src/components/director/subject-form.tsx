'use client';

import { SUBJECT_COLORS, SUBJECT_ICONS } from '@tajriba/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { subjectIcon } from '@/components/app/subject-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

const SWATCH: Record<string, string> = {
  violet: 'bg-violet',
  sky: 'bg-sky',
  mint: 'bg-mint',
  green: 'bg-green',
  coral: 'bg-coral',
  sunny: 'bg-sunny',
  pink: 'bg-coral',
  slate: 'bg-muted-foreground',
};

export interface SubjectFormValue {
  name: string;
  color: string;
  icon: string;
}

/** Add/edit form for a school subject: name, color swatch picker, icon picker. */
export function SubjectForm({ initial, busy, onSubmit, onCancel }: { initial?: SubjectFormValue; busy: boolean; onSubmit: (v: SubjectFormValue) => void; onCancel?: () => void }) {
  const t = useTranslations('director.subjects');
  const tc = useTranslations('common');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string>(initial?.color ?? SUBJECT_COLORS[0]);
  const [icon, setIcon] = useState<string>(initial?.icon ?? SUBJECT_ICONS[6]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    onSubmit({ name: value, color, icon });
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="subject-form" noValidate>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('namePlaceholder')}
        aria-label={t('namePlaceholder')}
        data-testid="subject-name"
      />
      <div>
        <p className="mb-1.5 text-sm font-bold">{t('color')}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('color')}>
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn('size-8 rounded-full transition-transform', SWATCH[c] ?? SWATCH.slate, color === c ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-card' : '')}
              data-testid={`subject-color-${c}`}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-bold">{t('icon')}</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('icon')}>
          {SUBJECT_ICONS.map((i) => {
            const Icon = subjectIcon(i);
            const on = icon === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={i}
                onClick={() => setIcon(i)}
                className={cn('flex size-10 items-center justify-center rounded-[12px] border-2 transition-colors', on ? 'border-primary bg-violet-soft' : 'border-border hover:bg-muted')}
                data-testid={`subject-icon-${i}`}
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()} data-testid="subject-save">
          {t('save')}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {tc('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
