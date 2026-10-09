'use client';

import { Check, Lightbulb, MessageCircleQuestion, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Arzino, ArzinoSays } from '@/components/arzino';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { fireConfetti } from '@/components/kid/celebrations';
import { useSound } from '@/components/app/theme';
import { FocusTop } from '@/components/student/focus-top';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar, Slider } from '@/components/ui/misc';
import { api, ApiError, uploadUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { Localized, ProofField } from '@/lib/types';
import type { I18nText } from '@tajriba/shared';

interface PeerReview {
  id: string;
  status: string;
  sheet: { checklist: { criterion: string; whatToLookFor: string }[]; questionsToAsk: string[]; commonMistakes: string[] };
  score: number | null;
  comment: string | null;
  submitter: { firstName: string; avatarUrl: string | null };
  mission: { id: string; title: I18nText; story: I18nText; steps: Localized<string[]>; proofSpec: { fields: ProofField[] }; xpReward: number };
  submission: { photoUploadIds: string[]; audioUploadId: string | null; explanation: string | null; answers: Record<string, string | number> | null; followUpQuestion: string | null; followUpAnswer: string | null };
}

export default function ReviewPage() {
  const t = useTranslations('mission');
  const tc = useTranslations('common');
  const l = useL();
  const sound = useSound();
  const invalidate = useInvalidate();
  const { id } = useParams<{ id: string }>();
  const { data: r, isLoading, error, refetch } = useApi<PeerReview>(`/peer-reviews/${id}`);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [score, setScore] = useState(75);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ xp: number; points: number } | null>(null);

  if (isLoading) return <PageSkeleton />;
  if (error || !r) return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />;
  const name = r.submitter.firstName;
  const allChecked = r.sheet.checklist.every((c) => checks[c.criterion] !== undefined);

  const complete = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ rewards: { xp: number; points: number } }>(`/peer-reviews/${id}/complete`, {
        body: { checklist: r.sheet.checklist.map((c) => ({ criterion: c.criterion, ok: !!checks[c.criterion] })), score, comment: comment.trim() || undefined },
      });
      setDone(res.rewards);
      fireConfetti();
      sound('coin');
      invalidate('/peer-reviews/assigned', '/gamification/me');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 py-10 text-center" data-testid="review-done">
        <Arzino mood="party" size={250} pop priority />
        <h1 className="font-display text-[32px] font-black text-cedar-ink dark:text-cedar">{t('reviewDone')}</h1>
        <motion.p
          initial={{ y: 20, scale: 0.8 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.3 }}
          className="rounded-[18px] border-2 border-med bg-med-soft px-6 py-3 font-display text-2xl font-black text-med-ink shadow-[0_5px_0_var(--med)] dark:text-white"
          data-testid="review-reward"
        >
          ⚡ {t('reviewReward', { xp: done.xp, points: done.points })} 🪙
        </motion.p>
        <Button asChild variant="kid" size="lg" className="mt-4 w-full max-w-sm">
          <Link href="/student">{tc('backHome')}</Link>
        </Button>
      </motion.div>
    );
  }

  const scoreTone = score >= 70 ? 'text-cedar' : score >= 50 ? 'text-med' : 'text-flag';

  return (
    <div className="space-y-5 pb-10">
      <FocusTop href="/student/reviews" progress={r.status !== 'ASSIGNED' ? 1 : (Object.keys(checks).length + (comment.trim() ? 1 : 0)) / (r.sheet.checklist.length + 1)} />

      <div className="flex items-center gap-3 sm:gap-5">
        <Arzino mood="clipboard" size={124} pop />
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-cedar-ink dark:!text-cedar">{t('reviewEyebrow')}</p>
          <h1 className="mt-0.5 font-display text-[26px] font-black leading-[1.1]">{l(r.mission.title)}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Avatar name={name} src={r.submitter.avatarUrl} className="size-8 text-xs" />
            <span className="text-sm font-black text-muted-foreground">{name}</span>
          </div>
        </div>
      </div>
      <p className="rounded-[18px] border-2 border-cedar/40 bg-cedar-soft p-4 font-bold text-cedar-ink dark:text-white">{t('reviewIntro', { name })}</p>

      <section className="chunky space-y-4 rounded-[24px] p-5">
        <h2 className="eyebrow">{t('theirProof')}</h2>
        {r.submission.photoUploadIds.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {r.submission.photoUploadIds.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated upload
              <img key={p} src={uploadUrl(p)} alt="" className="aspect-[4/3] w-full rounded-[16px] border-2 border-border object-cover" data-testid="peer-photo" />
            ))}
          </div>
        )}
        {r.submission.audioUploadId && <audio controls src={uploadUrl(r.submission.audioUploadId)} className="w-full" />}
        {r.submission.answers && Object.keys(r.submission.answers).length > 0 && (
          <div className="grid grid-cols-2 gap-2" dir="ltr">
            {Object.entries(r.submission.answers).map(([k, v]) => {
              const f = r.mission.proofSpec.fields?.find((x) => x.key === k);
              return (
                <div key={k} className="rounded-[16px] border-2 border-border bg-muted p-3">
                  <p className="text-xs font-black text-muted-foreground">{f ? l(f.label) : k}</p>
                  <p className="font-display text-xl font-black text-med-ink dark:text-med">
                    {v} {f?.unit}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {r.submission.explanation && (
          <div>
            <p className="text-sm font-black text-muted-foreground">{t('theirExplanation')}</p>
            <p className="mt-1 text-lg font-semibold">“{r.submission.explanation}”</p>
          </div>
        )}
        {r.submission.followUpAnswer && (
          <div className="rounded-[16px] border-2 border-med/30 bg-med-soft p-3">
            <p className="text-sm font-black">{r.submission.followUpQuestion}</p>
            <p className="mt-1 font-semibold italic">“{r.submission.followUpAnswer}”</p>
          </div>
        )}
      </section>

      {r.status !== 'ASSIGNED' ? (
        <ArzinoSays mood="proud" size={96}>
          {t('alreadyReviewed')}
        </ArzinoSays>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="eyebrow">{t('checklist')}</h2>
            {r.sheet.checklist.map((c) => {
              const v = checks[c.criterion];
              return (
                <div
                  key={c.criterion}
                  className={cn(
                    'rounded-[20px] border-2 p-4 transition-colors',
                    v === true ? 'border-cedar/60 bg-cedar-soft' : v === false ? 'border-flag/40 bg-flag-soft' : 'border-border bg-card shadow-[0_4px_0_var(--border)]',
                  )}
                  data-testid="checklist-item"
                >
                  <p className="text-[17px] font-black">{c.criterion}</p>
                  <p className="text-sm font-semibold text-muted-foreground">{t('lookFor', { text: c.whatToLookFor })}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setChecks((x) => ({ ...x, [c.criterion]: true }))}
                      className={cn(
                        'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[14px] border-2 font-black uppercase tracking-[0.06em] transition-transform active:translate-y-[3px]',
                        v === true ? 'border-cedar bg-cedar text-white shadow-[0_4px_0_var(--cedar-d)]' : 'border-border bg-card text-cedar-ink shadow-[0_4px_0_var(--border)] dark:text-cedar',
                      )}
                      aria-pressed={v === true}
                      data-testid="check-ok"
                    >
                      <Check className="size-5" strokeWidth={3} /> {t('ok')}
                    </button>
                    <button
                      onClick={() => setChecks((x) => ({ ...x, [c.criterion]: false }))}
                      className={cn(
                        'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[14px] border-2 font-black uppercase tracking-[0.06em] transition-transform active:translate-y-[3px]',
                        v === false ? 'border-flag bg-flag text-white shadow-[0_4px_0_var(--flag-d)]' : 'border-border bg-card text-flag-d shadow-[0_4px_0_var(--border)] dark:text-danger',
                      )}
                      aria-pressed={v === false}
                    >
                      <X className="size-5" strokeWidth={3} /> {t('notOk')}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="chunky space-y-3 rounded-[24px] p-5">
            <div className="flex items-center gap-3">
              <Arzino mood="thinking" size={72} />
              <h2 className="font-display text-xl font-black">
                <MessageCircleQuestion className="me-1.5 inline size-5 text-med" />
                {t('questionsToAsk')}
              </h2>
            </div>
            <ol className="space-y-2">
              {r.sheet.questionsToAsk.map((q, i) => (
                <li key={q} className="flex gap-3 font-semibold">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-med-soft text-sm font-black text-med-ink dark:text-white">{i + 1}</span>
                  {q}
                </li>
              ))}
            </ol>
            {r.sheet.commonMistakes.length > 0 && (
              <div className="mt-3 rounded-[16px] border-2 border-flame/40 bg-flame-soft p-3">
                <p className="flex items-center gap-2 text-sm font-black text-flame-d dark:text-flame">
                  <Lightbulb className="size-4" /> {t('commonMistakes')}
                </p>
                <ul className="mt-1 list-inside list-disc text-sm font-semibold">
                  {r.sheet.commonMistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="chunky space-y-4 rounded-[24px] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-black">{t('yourScore')}</h2>
              <span className={cn('font-display text-5xl font-black', scoreTone)} data-testid="peer-score-value">
                {score}
              </span>
            </div>
            <Slider value={[score]} min={0} max={100} step={5} onValueChange={(v) => setScore(v[0])} data-testid="peer-score" />
            <div>
              <label htmlFor="comment" className="eyebrow mb-1.5 block">
                {t('comment')}
              </label>
              <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('commentPlaceholder')} className="text-base" data-testid="peer-comment" />
            </div>
            {err && <p className="rounded-[16px] border-2 border-flag/40 bg-flag-soft p-3 font-bold text-flag-d dark:text-danger">{err}</p>}
            <Button variant="kid" size="lg" className="w-full" onClick={complete} loading={busy} disabled={!allChecked} data-testid="complete-review">
              {t('completeReview')} <Check strokeWidth={3} />
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
