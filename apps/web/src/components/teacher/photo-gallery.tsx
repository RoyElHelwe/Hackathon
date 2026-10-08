'use client';

import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { uploadUrl } from '@/lib/api';
import { cn } from '@/lib/cn';

/** Submission photos; click to enlarge. */
export function PhotoGallery({ ids, size = 'lg' }: { ids: string[]; size?: 'sm' | 'lg' }) {
  const t = useTranslations('teacher.review');
  const [open, setOpen] = useState<string | null>(null);
  if (!ids.length)
    return (
      <div className={cn('flex items-center justify-center gap-2 rounded-[16px] bg-muted text-sm text-muted-foreground', size === 'lg' ? 'h-40' : 'h-14 w-14')}>
        <ImageOff className="size-4" /> {size === 'lg' && t('noPhotos')}
      </div>
    );
  return (
    <>
      <div className={cn('grid gap-2', size === 'lg' ? (ids.length > 1 ? 'grid-cols-2' : 'grid-cols-1') : 'flex')}>
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpen(id)}
            className={cn('overflow-hidden rounded-[14px] bg-muted outline-offset-2', size === 'lg' ? 'aspect-[4/3]' : 'size-14 shrink-0')}
            aria-label={t('photoN', { n: i + 1 })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated upload served by the API proxy */}
            <img src={uploadUrl(id)} alt={t('photoN', { n: i + 1 })} className="size-full object-cover transition-transform hover:scale-105" loading="lazy" />
          </button>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl p-3">
          <DialogTitle className="sr-only">{t('photo')}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated upload served by the API proxy */}
          {open && <img src={uploadUrl(open)} alt={t('photo')} className="max-h-[80vh] w-full rounded-[16px] object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
