'use client';

import { Camera, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { uploadFile, uploadUrl } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Camera capture / upload of multiple photos. Uploads immediately (EXIF stripped server-side). */
export function PhotoPicker({ value, onChange, max = 5 }: { value: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const t = useTranslations('mission');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, max - value.length);
    setBusy(list.length);
    const ids = [...value];
    for (const f of list) {
      try {
        const up = await uploadFile(f, f.name);
        ids.push(up.id);
        onChange([...ids]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {value.map((id) => (
          <div key={id} className="relative aspect-square overflow-hidden rounded-[18px] border-2 border-border bg-muted shadow-[0_4px_0_var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated upload served by the API */}
            <img src={uploadUrl(id)} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="absolute end-1.5 top-1.5 rounded-full bg-ink/70 p-1 text-white" aria-label={t('removePhoto')}>
              <X className="size-4" />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`b${i}`} className="flex aspect-square animate-pulse items-center justify-center rounded-[16px] bg-muted text-xs font-bold text-muted-foreground">
            {t('uploading')}
          </div>
        ))}
        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn('flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-med/60 bg-med-soft p-2 text-center text-xs font-black uppercase tracking-[0.05em] text-med-ink transition-colors hover:bg-med/15 dark:text-white')}
          >
            <Camera className="size-9" strokeWidth={2.2} />
            {t('takePhoto')}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => add(e.target.files)} data-testid="photo-input" aria-label={t('takePhoto')} />
      {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
