'use client';

import { Check, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface Props {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  disabled?: boolean;
  className?: string;
  label: string;
  testId?: string;
}

/** Click-to-edit text. Saves through `onSave` (which may throw — the editor then stays open). */
export function EditableText({ value, onSave, multiline, disabled, className, label, testId }: Props) {
  const t = useTranslations('teacher.studio');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  const start = () => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  };
  const save = async () => {
    const v = draft.trim();
    if (!v || v === value) return setEditing(false);
    setBusy(true);
    try {
      await onSave(v);
      setEditing(false);
    } catch {
      // parent shows the error; keep the editor open
    } finally {
      setBusy(false);
    }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setEditing(false);
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  if (editing)
    return (
      <div className="space-y-2" data-testid={testId ? `${testId}-editor` : undefined}>
        {multiline ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} autoFocus aria-label={label} className="min-h-24 text-sm" />
        ) : (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} autoFocus aria-label={label} className="h-11 font-bold" />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} loading={busy}>
            <Check /> {t('save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
            <X /> {t('cancel')}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="group relative">
      <div
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onClick={start}
        onKeyDown={(e) => e.key === 'Enter' && start()}
        className={cn(!disabled && '-mx-2 cursor-text rounded-[10px] px-2 py-0.5 transition-colors hover:bg-muted/70', className)}
        data-testid={testId}
        aria-label={disabled ? undefined : `${label} — ${t('clickToEdit')}`}
      >
        {value}
        {!disabled && <Pencil className="ms-1.5 inline size-3.5 align-baseline text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </div>
    </div>
  );
}
