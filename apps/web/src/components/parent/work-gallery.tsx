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
        <CardTitle className="flex items-center gap-2">
          <Camera className="size-5 text-primary" /> {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title={t('empty')} mood="sleepy" className="py-4" />
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
    <button type="button" onClick={onOpen} className="group text-start" data-testid="work-photo">
      <div className="relative aspect-square overflow-hidden rounded-[16px] bg-muted">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated upload served through the API proxy
          <img src={uploadUrl(photo)} alt={l(work.title)} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center text-sm font-semibold text-muted-foreground">{t('noPhoto')}</div>
        )}
        <StatusBadge status={work.status} className="absolute start-2 top-2 shadow-sm" />
        {work.audience === 'FAMILY' && (
          <span className="absolute bottom-2 end-2 flex size-7 items-center justify-center rounded-full bg-card/90 text-coral shadow-sm" title={t('family')}>
            <Heart className="size-4 fill-current" />
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug">{l(work.title)}</p>
      <p className="text-xs text-muted-foreground">
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
          <img key={id} src={uploadUrl(id)} alt={l(work.title)} className="max-h-[65vh] w-full rounded-[16px] object-contain bg-muted" />
        ))}
      </div>
    </div>
  );
}
