'use client';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Numbered step list with inline editing (add / remove / reword). */
export function EditableSteps({ steps, onSave, disabled }: { steps: string[]; onSave: (s: string[]) => Promise<void>; disabled?: boolean }) {
  const t = useTranslations('teacher.studio');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(steps);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const clean = draft.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return;
    setBusy(true);
    try {
      await onSave(clean);
      setEditing(false);
    } catch {
      // error surfaced by parent
    } finally {
      setBusy(false);
    }
  };

  if (editing)
    return (
      <div className="space-y-2" data-testid="steps-editor">
        {draft.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-xs font-extrabold text-primary dark:text-white">{i + 1}</span>
            <Input value={s} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))} className="h-10 text-sm" aria-label={t('stepN', { n: i + 1 })} />
            <Button size="icon" variant="ghost" className="size-10 shrink-0" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} aria-label={t('removeStep')}>
              <Trash2 className="!size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {draft.length < 8 && (
            <Button size="sm" variant="outline" onClick={() => setDraft((d) => [...d, ''])}>
              <Plus /> {t('addStep')}
            </Button>
          )}
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
    <div className="group">
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-soft text-xs font-extrabold text-primary dark:text-white">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {!disabled && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-8 text-muted-foreground"
          onClick={() => {
            setDraft(steps);
            setEditing(true);
          }}
          data-testid="edit-steps"
        >
          <Pencil className="!size-3.5" /> {t('editSteps')}
        </Button>
      )}
    </div>
  );
}
