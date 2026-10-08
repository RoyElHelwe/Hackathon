'use client';

import { Heart, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bousla } from '@/components/bousla';
import { fireConfetti } from '@/components/kid/celebrations';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { api, ApiError, uploadUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useInvalidate } from '@/lib/hooks';
import type { Rewards } from '@/lib/types';
import type { ChildSubmission } from './types';

/** One child's submission of a family mission: proof + "We did it together!" confirmation. */
export function FamilySubmission({ sub }: { sub: ChildSubmission }) {
  const t = useTranslations('parent.family');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const invalidate = useInvalidate();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ xp: number; note: string } | null>(null);
  const name = sub.child.firstName;

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ ok: boolean; rewards: Rewards | null }>(`/families/missions/${sub.id}/confirm`, { body: { note: note.trim() || undefined } });
      setDone({ xp: res.rewards?.xpGained ?? 0, note: note.trim() });
      fireConfetti(true);
      void invalidate('/families/missions', `/dashboards/parent/${sub.child.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('confirm'));
    } finally {
      setBusy(false);
    }
  };

  const confirmedNote = done ? done.note : sub.confirmation?.note;
  const confirmed = done || sub.confirmation;

  return (
    <div className="rounded-[18px] border border-border bg-background/60 p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        {sub.photoUploadIds.length > 0 && (
          <div className={cn('grid gap-2 sm:grid-cols-1', sub.photoUploadIds.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {sub.photoUploadIds.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated upload served through the API proxy
              <img key={id} src={uploadUrl(id)} alt={t('photoAlt', { name })} className="aspect-[4/3] w-full rounded-[14px] bg-muted object-cover" data-testid="family-photo" />
            ))}
          </div>
        )}
        <div className="min-w-0 space-y-3">
          {sub.explanation && (
            <figure className="relative rounded-[16px] bg-violet-soft p-4">
              <Quote className="absolute end-3 top-3 size-5 text-primary/40 rtl-flip" aria-hidden />
              <figcaption className="mb-1 text-xs font-extrabold uppercase tracking-wider text-primary dark:text-white">{t('childSays', { name })}</figcaption>
              <blockquote className="pe-6 leading-relaxed" dir="auto">
                {sub.explanation}
              </blockquote>
            </figure>
          )}
          {sub.submittedAt && <p className="text-xs text-muted-foreground">{t('submitted', { date: format.relativeTime(new Date(sub.submittedAt), now) })}</p>}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmed ? (
          <motion.div
            key="done"
            initial={done ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex items-center gap-4 rounded-[18px] bg-mint-soft p-4"
            data-testid="family-confirmed"
          >
            <Bousla mood="cheering" size={done ? 84 : 60} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-extrabold text-success">{t('confirmedTitle')}</p>
              {done ? (
                <p className="text-sm font-semibold">{t('confirmedBody', { name, xp: done.xp })}</p>
              ) : (
                sub.confirmation && <p className="text-sm text-muted-foreground">{t('confirmedOn', { date: format.dateTime(new Date(sub.confirmation.confirmedAt), { dateStyle: 'medium' }) })}</p>
              )}
              {confirmedNote && (
                <p className="mt-2 rounded-[12px] bg-card px-3 py-2 text-sm" dir="auto">
                  <span className="font-bold">{t('yourNote')}: </span>
                  {confirmedNote}
                </p>
              )}
            </div>
          </motion.div>
        ) : sub.status === 'FAMILY_CONFIRM' ? (
          <motion.div key="form" exit={{ opacity: 0 }} className="mt-4 space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-coral-soft px-3 py-1 text-sm font-bold text-danger">
              <Heart className="size-4 fill-current" /> {t('waiting')}
            </p>
            <div>
              <Label htmlFor={`note-${sub.id}`}>{t('noteLabel', { name })}</Label>
              <Textarea id={`note-${sub.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} maxLength={500} className="min-h-20" data-testid="family-note" />
            </div>
            {err && (
              <p className="rounded-[12px] bg-coral-soft px-3 py-2 text-sm font-semibold text-danger" role="alert">
                {err}
              </p>
            )}
            <Button variant="kidMint" size="pill" className="h-16 w-full text-xl" onClick={confirm} loading={busy} data-testid="confirm-family-mission">
              {!busy && <span aria-hidden>🤝</span>} {t('confirm')}
            </Button>
          </motion.div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-muted-foreground">{t('inProgress', { name })}</p>
        )}
      </AnimatePresence>
    </div>
  );
}
