'use client';

import { Check, Lightbulb, MessageCircleQuestion, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Bousla, BouslaSays } from '@/components/bousla';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { fireConfetti } from '@/components/kid/celebrations';
import { useSound } from '@/components/app/theme';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
        <Bousla mood="cheering" size={150} />
        <h1 className="font-display text-3xl font-extrabold">{t('reviewDone')}</h1>
        <motion.p initial={{ y: 20 }} animate={{ y: 0 }} className="rounded-full bg-mint-soft px-6 py-3 font-display text-2xl font-extrabold text-success" data-testid="review-reward">
          {t('reviewReward', { xp: done.xp, points: done.points })} 🪙
        </motion.p>
        <Button asChild variant="kid" size="pill">
          <Link href="/student">{tc('backHome')}</Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={r.submitter.avatarUrl} className="size-14 text-lg" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('reviewTitle')}</p>
          <h1 className="font-display text-2xl font-extrabold leading-tight">{l(r.mission.title)}</h1>
        </div>
      </div>
      <BouslaSays mood="happy" size={60}>
        {t('reviewIntro', { name })}
      </BouslaSays>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-xl font-extrabold">{t('theirProof')}</h2>
        {r.submission.photoUploadIds.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {r.submission.photoUploadIds.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated upload
              <img key={p} src={uploadUrl(p)} alt="" className="aspect-[4/3] w-full rounded-[14px] object-cover" data-testid="peer-photo" />
            ))}
          </div>
        )}
        {r.submission.audioUploadId && <audio controls src={uploadUrl(r.submission.audioUploadId)} className="w-full" />}
        {r.submission.answers && Object.keys(r.submission.answers).length > 0 && (
          <div className="grid grid-cols-2 gap-2" dir="ltr">
            {Object.entries(r.submission.answers).map(([k, v]) => {
              const f = r.mission.proofSpec.fields?.find((x) => x.key === k);
              return (
                <div key={k} className="rounded-[14px] bg-muted p-3">
                  <p className="text-xs font-bold text-muted-foreground">{f ? l(f.label) : k}</p>
                  <p className="font-display text-xl font-extrabold">
                    {v} {f?.unit}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {r.submission.explanation && (
          <div>
            <p className="text-sm font-bold text-muted-foreground">{t('theirExplanation')}</p>
            <p className="mt-1 text-lg">“{r.submission.explanation}”</p>
          </div>
        )}
        {r.submission.followUpAnswer && (
          <div className="rounded-[14px] bg-violet-soft/60 p-3">
            <p className="text-sm font-bold">{r.submission.followUpQuestion}</p>
            <p className="mt-1 italic">“{r.submission.followUpAnswer}”</p>
          </div>
        )}
      </Card>

      {r.status !== 'ASSIGNED' ? (
        <BouslaSays mood="happy">{t('alreadyReviewed')}</BouslaSays>
      ) : (
        <>
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-xl font-extrabold">{t('checklist')}</h2>
            {r.sheet.checklist.map((c) => {
              const v = checks[c.criterion];
              return (
                <div key={c.criterion} className="rounded-[16px] border-2 border-border p-3" data-testid="checklist-item">
                  <p className="font-extrabold">{c.criterion}</p>
                  <p className="text-sm text-muted-foreground">{t('lookFor', { text: c.whatToLookFor })}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setChecks((x) => ({ ...x, [c.criterion]: true }))} className={cn('flex h-11 flex-1 items-center justify-center gap-1 rounded-[12px] border-2 font-bold', v === true ? 'border-mint bg-mint text-ink' : 'border-border')} data-testid="check-ok">
                      <Check className="size-5" /> {t('ok')}
                    </button>
                    <button onClick={() => setChecks((x) => ({ ...x, [c.criterion]: false }))} className={cn('flex h-11 flex-1 items-center justify-center gap-1 rounded-[12px] border-2 font-bold', v === false ? 'border-coral bg-coral text-white' : 'border-border')}>
                      <X className="size-5" /> {t('notOk')}
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card className="space-y-2 p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
              <MessageCircleQuestion className="size-5 text-primary" /> {t('questionsToAsk')}
            </h2>
            <ol className="list-inside list-decimal space-y-1">
              {r.sheet.questionsToAsk.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            {r.sheet.commonMistakes.length > 0 && (
              <div className="mt-3 rounded-[14px] bg-sunny-soft p-3">
                <p className="flex items-center gap-2 text-sm font-extrabold">
                  <Lightbulb className="size-4" /> {t('commonMistakes')}
                </p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {r.sheet.commonMistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">{t('yourScore')}</h2>
              <span className="font-display text-4xl font-extrabold text-primary" data-testid="peer-score-value">
                {score}
              </span>
            </div>
            <Slider value={[score]} min={0} max={100} step={5} onValueChange={(v) => setScore(v[0])} data-testid="peer-score" />
            <div>
              <label htmlFor="comment" className="mb-1 block font-bold">
                {t('comment')}
              </label>
              <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('commentPlaceholder')} data-testid="peer-comment" />
            </div>
            {err && <p className="rounded-[14px] bg-coral-soft p-3 font-semibold text-danger">{err}</p>}
            <Button variant="kidMint" size="pill" className="w-full" onClick={complete} loading={busy} disabled={!allChecked} data-testid="complete-review">
              {t('completeReview')} ✓
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
