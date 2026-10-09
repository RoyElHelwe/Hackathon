'use client';

import { Heart, HeartHandshake, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Arzino } from '@/components/arzino';
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
    <div className="rounded-[18px] border-2 border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
        {sub.photoUploadIds.length > 0 && (
          <div className={cn('grid gap-2 sm:grid-cols-1', sub.photoUploadIds.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {sub.photoUploadIds.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated upload served through the API proxy
              <img key={id} src={uploadUrl(id)} alt={t('photoAlt', { name })} className="aspect-[4/3] w-full rounded-[14px] border-2 border-border bg-muted object-cover" data-testid="family-photo" />
            ))}
          </div>
        )}
        <div className="min-w-0 space-y-3">
          {sub.explanation && (
            <figure className="relative rounded-[16px] bg-med-soft p-4">
              <Quote className="absolute end-3 top-3 size-5 text-med/50 rtl-flip" aria-hidden />
              <figcaption className="mb-1 text-[12px] font-black uppercase tracking-[0.09em] text-med-ink dark:text-ring">{t('childSays', { name })}</figcaption>
              <blockquote className="pe-6 font-semibold leading-relaxed" dir="auto">
                {sub.explanation}
              </blockquote>
            </figure>
          )}
          {sub.submittedAt && <p className="text-xs font-bold text-muted-foreground">{t('submitted', { date: format.relativeTime(new Date(sub.submittedAt), now) })}</p>}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmed ? (
          <motion.div
            key="done"
            initial={done ? { opacity: 0, scale: 0.95 } : false}
            animate={{ opacity: 1, scale: 1 }}
            className={cn('mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] border-2 border-cedar/30 bg-cedar-soft p-4', done && 'justify-center text-center sm:flex-nowrap sm:justify-start sm:text-start')}
            data-testid="family-confirmed"
          >
            <Arzino mood={done ? 'celebrate' : 'streak-hug'} size={done ? 150 : 72} pop={!!done} className="-my-2 shrink-0" />
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-2xl font-black text-cedar-ink dark:text-success">{t('confirmedTitle')}</p>
              {done ? (
                <p className="font-bold">{t('confirmedBody', { name, xp: done.xp })}</p>
              ) : (
                sub.confirmation && <p className="text-sm font-semibold text-muted-foreground">{t('confirmedOn', { date: format.dateTime(new Date(sub.confirmation.confirmedAt), { dateStyle: 'medium' }) })}</p>
              )}
              {confirmedNote && (
                <p className="mt-2 rounded-[12px] border-2 border-border bg-card px-3 py-2 text-start text-sm font-semibold" dir="auto">
                  <span className="font-bold">{t('yourNote')}: </span>
                  {confirmedNote}
                </p>
              )}
            </div>
          </motion.div>
        ) : sub.status === 'FAMILY_CONFIRM' ? (
          <motion.div key="form" exit={{ opacity: 0 }} className="mt-4 space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-flame-soft px-3 py-1 text-sm font-black text-flame-d dark:text-warning">
              <Heart className="size-4 fill-current" /> {t('waiting')}
            </p>
            <div>
              <Label htmlFor={`note-${sub.id}`}>{t('noteLabel', { name })}</Label>
              <Textarea id={`note-${sub.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} maxLength={500} className="min-h-20" data-testid="family-note" />
            </div>
            {err && (
              <p className="rounded-[12px] bg-flag-soft px-3 py-2 text-sm font-bold text-flag-d dark:text-danger" role="alert">
                {err}
              </p>
            )}
            <Button variant="kid" size="pill" className="h-16 w-full text-lg [&_svg]:size-7" onClick={confirm} loading={busy} data-testid="confirm-family-mission">
              {!busy && <HeartHandshake />} {t('confirm')}
            </Button>
          </motion.div>
        ) : (
          <p className="mt-4 rounded-[14px] bg-muted px-3 py-2.5 text-sm font-bold text-muted-foreground">{t('inProgress', { name })}</p>
        )}
      </AnimatePresence>
    </div>
  );
}
