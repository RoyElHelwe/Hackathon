'use client';

import { Camera, Heart } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { uploadUrl } from '@/lib/api';
import { useL } from '@/lib/hooks';
import { StatusBadge } from './status-badge';
import type { ParentDashboard } from './types';

type Work = ParentDashboard['recentWork'][number];

/** Photo gallery of the child's recent mission proofs. Tap a photo to see it large. */
export function WorkGallery({ items }: { items: Work[] }) {
  const t = useTranslations('parent.work');
  const [open, setOpen] = useState<Work | null>(null);
  return (
    <Card data-testid="recent-work">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="flex size-9 items-center justify-center rounded-[12px] bg-flame-soft text-flame-d dark:text-warning">
            <Camera className="size-5" />
          </span>
          {t('title')}
        </CardTitle>
        <CardDescription className="font-semibold">{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={t('empty')} mood="bored-waiting" className="py-4" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((w) => (
              <WorkTile key={w.submissionId} work={w} onOpen={() => setOpen(w)} />
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl p-4 sm:p-6">{open && <WorkDetail work={open} />}</DialogContent>
      </Dialog>
    </Card>
  );
}

function WorkTile({ work, onOpen }: { work: Work; onOpen: () => void }) {
  const t = useTranslations('parent.work');
  const l = useL();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const photo = work.photoUploadIds[0];
  return (
    <button type="button" onClick={onOpen} className="group rounded-[18px] text-start outline-none focus-visible:ring-4 focus-visible:ring-ring/40" data-testid="work-photo">
      <div className="relative aspect-square overflow-hidden rounded-[18px] border-2 border-border bg-muted shadow-[0_4px_0_var(--border)] transition-transform group-hover:-translate-y-0.5">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated upload served through the API proxy
          <img src={uploadUrl(photo)} alt={l(work.title)} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-sm font-bold text-muted-foreground">
            <Camera className="size-6 opacity-60" />
            {t('noPhoto')}
          </div>
        )}
        <StatusBadge status={work.status} className="absolute start-2 top-2" />
        {work.audience === 'FAMILY' && (
          <span className="absolute bottom-2 end-2 flex size-8 items-center justify-center rounded-full bg-card text-flag shadow-[0_2px_0_var(--border)]" title={t('family')}>
            <Heart className="size-4 fill-current" />
          </span>
        )}
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm font-extrabold leading-snug">{l(work.title)}</p>
      <p className="text-xs font-bold text-muted-foreground">
        {format.relativeTime(new Date(work.at), now)}
        {work.finalScore != null && <> · {t('score', { score: work.finalScore })}</>}
      </p>
    </button>
  );
}

function WorkDetail({ work }: { work: Work }) {
  const t = useTranslations('parent.work');
  const l = useL();
  const format = useFormatter();
  return (
    <div>
      <DialogTitle className="pe-10">{l(work.title)}</DialogTitle>
      <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
        <StatusBadge status={work.status} />
        <span>{format.dateTime(new Date(work.at), { dateStyle: 'medium' })}</span>
        {work.finalScore != null && <span>· {t('score', { score: work.finalScore })}</span>}
      </DialogDescription>
      <div className="mt-4 grid gap-3">
        {work.photoUploadIds.map((id) => (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated upload served through the API proxy
          <img key={id} src={uploadUrl(id)} alt={l(work.title)} className="max-h-[65vh] w-full rounded-[16px] border-2 border-border bg-muted object-contain" />
        ))}
      </div>
    </div>
  );
}
