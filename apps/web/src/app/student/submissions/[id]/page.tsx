'use client';

import { ArrowRight, RefreshCw, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bousla, BouslaSays } from '@/components/bousla';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { ValidatedStamp } from '@/components/kid/celebrations';
import { RewardCelebration } from '@/components/student/reward-celebration';
import { ScoreDial } from '@/components/student/score-dial';
import { VoiceInput } from '@/components/student/voice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { Textarea } from '@/components/ui/input';
import { api, ApiError, uploadUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { Submission } from '@/lib/types';

const WAITING = ['PEER_REVIEW', 'TEACHER_REVIEW', 'FAMILY_CONFIRM', 'SUBMITTED'];

export default function SubmissionResult() {
  const t = useTranslations('mission');
  const tc = useTranslations('common');
  const l = useL();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { id } = useParams<{ id: string }>();
  const q = useApi<Submission>(`/submissions/${id}`, {
    // Live updates while someone else is reviewing (peer, teacher, family).
    refetchInterval: (query) => (query.state.data && WAITING.includes(query.state.data.status) ? 4000 : false),
  });
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rated, setRated] = useState<number | null>(null);
  const [celebrated, setCelebrated] = useState(false);

  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data) return <ErrorState message={q.error instanceof ApiError ? q.error.message : undefined} onRetry={() => q.refetch()} />;
  const s = q.data;
  const ai = s.aiCheck;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await q.refetch();
      invalidate('/missions', '/gamification/me', '/peer-reviews/assigned');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  const retry = () =>
    act(async () => {
      await api(`/submissions/${s.id}/retry`, { method: 'POST' });
      router.push(`/student/missions/${s.mission.id}`);
    });

  return (
    <div className="space-y-5 pb-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t('resultTitle')} {s.attempt > 1 && `· ${t('attempt', { n: s.attempt })}`}
        </p>
        <h1 className="font-display text-2xl font-extrabold leading-tight">{l(s.mission.title)}</h1>
      </div>

      {s.status === 'VALIDATED' && (
        <div className="relative space-y-4">
          {s.rewards && !s.rewards.seen && !celebrated && <RewardCelebration rewards={s.rewards} onDone={() => setCelebrated(true)} />}
          <Card className="flex flex-col items-center gap-3 border-2 border-mint p-6 text-center" data-testid="validated">
            <Bousla mood="cheering" size={110} />
            <ValidatedStamp label={t('validated')} />
            <p className="text-lg font-semibold">{t('validatedBody')}</p>
            {s.finalScore != null && (
              <Badge variant="mint" className="text-base">
                {t('score')}: {s.finalScore}
              </Badge>
            )}
            {s.rewards && s.rewards.xpGained > 0 && <p className="font-display text-xl font-extrabold text-success">+{s.rewards.xpGained} XP</p>}
            {s.teacherReview?.comment && <p className="w-full rounded-[14px] bg-mint-soft p-3 font-semibold">“{s.teacherReview.comment}”</p>}
          </Card>
          {s.rewards?.unlockedTopics?.length ? (
            <Button asChild variant="kidSunny" size="pill" className="w-full">
              <Link href={`/student/map?unlocked=${s.rewards.unlockedTopics.map((u) => u.id).join(',')}`} data-testid="see-map">
                ✨ {l(s.rewards.unlockedTopics[0].name)} → 🗺️
              </Link>
            </Button>
          ) : null}
        </div>
      )}

      {/* AI failed earlier: work is saved, offer to check again */}
      {s.status === 'SUBMITTED' && (
        <Card className="p-5 text-center">
          {busy ? <Thinking /> : <BouslaSays mood="sleepy">{t('aiUnavailable')}</BouslaSays>}
          <Button className="mt-4" variant="kid" onClick={() => act(() => api(`/submissions/${s.id}/check`, { method: 'POST' }))} loading={busy}>
            <RefreshCw /> {t('checkAgain')}
          </Button>
        </Card>
      )}

      {ai && (
        <Card className="p-5">
          <ScoreDial score={s.effectiveAiScore ?? ai.score} label={t('score')} />
          <div className="mt-4 flex flex-wrap justify-center gap-2" data-testid="criteria">
            {ai.perCriterion.map((c) => (
              <span key={c.criterion} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold', c.score >= 70 ? 'bg-mint-soft text-success' : c.score >= 50 ? 'bg-sunny-soft text-warning' : 'bg-coral-soft text-danger')}>
                {c.score >= 70 ? '✓' : '•'} {c.criterion}
              </span>
            ))}
          </div>
          <BouslaSays mood={ai.score >= 50 ? 'happy' : 'curious'} size={60} className="mt-5">
            <span className="font-normal" data-testid="ai-feedback">
              {ai.feedback}
            </span>
          </BouslaSays>
        </Card>
      )}

      {/* Mandatory follow-up question */}
      {s.status === 'AI_CHECKED' && ai && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-primary/30 p-5">
            <div className="flex items-start gap-3">
              <Bousla mood="curious" size={72} className="shrink-0" />
              <div>
                <p className="font-display text-xl font-extrabold text-primary">{t('followUpTitle')}</p>
                <p className="mt-1 text-lg font-semibold" data-testid="follow-up-question">
                  {ai.followUpQuestion}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t('followUpSub')}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <VoiceInput onTranscript={(text) => setAnswer(text)} />
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('answerPlaceholder')} data-testid="follow-up-answer" />
              <Button
                variant="kid"
                size="pill"
                className="w-full"
                disabled={!answer.trim()}
                loading={busy}
                onClick={() => act(() => api(`/submissions/${s.id}/follow-up`, { body: { answer: answer.trim() } }))}
                data-testid="send-follow-up"
              >
                {t('answer')} <ArrowRight className="rtl-flip" />
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {s.aiFollowUpCheck && s.status !== 'AI_CHECKED' && (
        <Card className="p-4">
          <p className="text-sm font-bold text-muted-foreground">{ai?.followUpQuestion}</p>
          <p className="mt-1 italic">“{s.followUpAnswer}”</p>
          <p className={cn('mt-2 font-semibold', s.aiFollowUpCheck.understood ? 'text-success' : 'text-warning')}>{s.aiFollowUpCheck.feedback}</p>
        </Card>
      )}

      {s.status === 'PEER_REVIEW' && s.peer && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="flex flex-col items-center gap-3 border-2 border-sky bg-sky-soft p-6 text-center" data-testid="sent-to-peer">
            <div className="flex items-center gap-3">
              <Avatar name={s.peer.evaluatorFirstName} src={s.peer.evaluatorAvatarUrl} className="size-16 text-xl" />
              <motion.span animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-3xl" aria-hidden>
                📨
              </motion.span>
            </div>
            <p className="font-display text-2xl font-extrabold">{t('sentToPeer', { name: s.peer.evaluatorFirstName })}</p>
            <p className="text-muted-foreground">{t('sentToPeerBody', { name: s.peer.evaluatorFirstName })}</p>
          </Card>
        </motion.div>
      )}
      {s.status === 'TEACHER_REVIEW' && (
        <Card className="flex flex-col items-center gap-2 p-6 text-center" data-testid="sent-to-teacher">
          <Bousla mood="happy" size={90} />
          <p className="font-display text-2xl font-extrabold">{t('teacherReview')}</p>
          <p className="text-muted-foreground">{t('teacherReviewBody')}</p>
        </Card>
      )}
      {s.status === 'FAMILY_CONFIRM' && (
        <Card className="flex flex-col items-center gap-2 border-2 border-coral bg-coral-soft p-6 text-center" data-testid="family-confirm">
          <span className="text-5xl" aria-hidden>
            👨‍👩‍👧
          </span>
          <p className="font-display text-2xl font-extrabold">{t('familyConfirm')}</p>
          <p className="text-muted-foreground">{t('familyConfirmBody')}</p>
        </Card>
      )}

      {s.status === 'RETRY' && (
        <Card className="border-2 border-sunny bg-sunny-soft p-6 text-center" data-testid="retry-card">
          <Bousla mood="curious" size={90} className="mx-auto" />
          <p className="mt-2 font-display text-2xl font-extrabold">{t('almost')}</p>
          <p className="text-muted-foreground">{t('almostBody')}</p>
          {s.teacherReview?.comment && <p className="mt-3 rounded-[14px] bg-card p-3 font-semibold">“{s.teacherReview.comment}”</p>}
          {s.peer?.comment && <p className="mt-3 rounded-[14px] bg-card p-3 font-semibold">“{s.peer.comment}”</p>}
          <Button variant="kidSunny" size="pill" className="mt-5 w-full" onClick={retry} loading={busy} data-testid="try-again">
            <RefreshCw /> {t('tryAgain')}
          </Button>
        </Card>
      )}

      {/* Peer feedback + helpfulness rating */}
      {s.peer && s.peer.status === 'DONE' && (
        <Card className="p-5" data-testid="peer-feedback">
          <div className="flex items-center gap-3">
            <Avatar name={s.peer.evaluatorFirstName} src={s.peer.evaluatorAvatarUrl} />
            <p className="font-extrabold">{t('peerFeedback', { name: s.peer.evaluatorFirstName })}</p>
            {s.peer.score != null && <Badge variant="default">{s.peer.score}/100</Badge>}
          </div>
          {s.peer.comment && <p className="mt-3 text-lg">“{s.peer.comment}”</p>}
          <div className="mt-4">
            <p className="text-sm font-bold">{t('rateReview', { name: s.peer.evaluatorFirstName })}</p>
            <div className="mt-2 flex gap-1" role="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => {
                const value = rated ?? s.peer?.helpfulRating ?? 0;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={value === n}
                    disabled={!!s.peer?.helpfulRating || rated != null}
                    onClick={() => act(async () => { await api(`/peer-reviews/${s.peer!.id}/rate`, { body: { helpfulRating: n } }); setRated(n); })}
                    className="p-1"
                    aria-label={`${n}`}
                    data-testid={`rate-${n}`}
                  >
                    <Star className={cn('size-9', n <= value ? 'fill-sunny text-sunny' : 'text-muted-foreground')} />
                  </button>
                );
              })}
            </div>
            {(rated || s.peer.helpfulRating) && <p className="mt-1 text-sm text-success">{t('thanksRating')}</p>}
          </div>
        </Card>
      )}

      {s.photoUploadIds.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {s.photoUploadIds.map((pid) => (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated upload
            <img key={pid} src={uploadUrl(pid)} alt="" className="aspect-square w-full rounded-[14px] object-cover" />
          ))}
        </div>
      )}

      {err && <p className="rounded-[14px] bg-coral-soft p-3 text-center font-semibold text-danger">{err}</p>}

      <Button asChild variant="outline" className="w-full">
        <Link href="/student/missions">{t('backToMissions')}</Link>
      </Button>
    </div>
  );
}
