'use client';

import { ArrowRight, RefreshCw, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Arzino, ArzinoSays } from '@/components/arzino';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { ValidatedStamp } from '@/components/kid/celebrations';
import { RewardCelebration } from '@/components/student/reward-celebration';
import { FocusTop } from '@/components/student/focus-top';
import { ScoreDial } from '@/components/student/score-dial';
import { subjectStyle } from '@/components/student/subject-style';
import { VoiceInput } from '@/components/student/voice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const st = subjectStyle(s.mission.topic?.subject?.key, s.mission.topic?.subject?.color, s.mission.topic?.subject?.icon);
  const aiScore = ai ? (s.effectiveAiScore ?? ai.score) : 0;
  const validated = s.status === 'VALIDATED';
  const progress = validated ? 1 : s.status === 'RETRY' ? 0.6 : s.status === 'AI_CHECKED' ? 0.8 : WAITING.includes(s.status) ? 0.92 : 0.75;
  const aiMood = aiScore >= 70 ? 'correct' : aiScore >= 50 ? 'cheer' : 'oops';

  return (
    <div className="space-y-6 pb-10">
      <FocusTop href="/student/missions" progress={progress} color={validated ? 'var(--cedar)' : st.hex} />

      {!validated && (
        <div>
          <p className={cn('eyebrow', st.text)}>
            {t('resultTitle')} {s.attempt > 1 && `· ${t('attempt', { n: s.attempt })}`}
          </p>
          <h1 className="mt-0.5 font-display text-[26px] font-black leading-tight">{l(s.mission.title)}</h1>
        </div>
      )}

      {validated && (
        <div className="relative space-y-5">
          {s.rewards && !s.rewards.seen && !celebrated && <RewardCelebration rewards={s.rewards} onDone={() => setCelebrated(true)} />}
          <div className="flex flex-col items-center gap-3 pt-2 text-center" data-testid="validated">
            <Arzino mood={(s.finalScore ?? 0) >= 90 ? 'party' : 'celebrate'} size={240} pop priority />
            <ValidatedStamp label={t('validated')} />
            <h1 className="mt-2 font-display text-[32px] font-black leading-tight text-cedar-ink dark:text-cedar">{t('missionComplete')}</h1>
            <p className="text-lg font-bold text-muted-foreground">{l(s.mission.title)}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ScoreTile label={t('tileXp')} tone="med" value={`⚡ ${s.rewards?.xpGained ?? s.mission.xpReward}`} />
            <ScoreTile label={t('tileScore')} tone="cedar" value={s.finalScore != null ? `${s.finalScore}` : '✓'} />
            <ScoreTile label={t('tileAttempt')} tone="flag" value={`#${s.attempt}`} />
          </div>
          {s.teacherReview?.comment && (
            <ArzinoSays mood="teaching" size={76}>
              “{s.teacherReview.comment}”
            </ArzinoSays>
          )}
          {s.rewards?.unlockedTopics?.length ? (
            <Button asChild variant="kidSunny" size="lg" className="w-full">
              <Link href={`/student/map?unlocked=${s.rewards.unlockedTopics.map((u) => u.id).join(',')}`} data-testid="see-map">
                ✨ {l(s.rewards.unlockedTopics[0].name)} → 🗺️
              </Link>
            </Button>
          ) : null}
        </div>
      )}

      {/* AI failed earlier: work is saved, offer to check again */}
      {s.status === 'SUBMITTED' && (
        <div className="chunky flex flex-col items-center gap-3 rounded-[24px] p-6 text-center">
          {busy ? <Thinking /> : <Arzino mood="sleepy" size={150} />}
          {!busy && <p className="max-w-sm text-lg font-bold">{t('aiUnavailable')}</p>}
          <Button variant="kid" onClick={() => act(() => api(`/submissions/${s.id}/check`, { method: 'POST' }))} loading={busy}>
            <RefreshCw /> {t('checkAgain')}
          </Button>
        </div>
      )}

      {ai && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className={cn('rounded-[24px] border-2 p-5', aiScore >= 70 ? 'border-cedar/40 bg-cedar-soft' : aiScore >= 50 ? 'border-med/40 bg-med-soft' : 'border-flag/30 bg-flag-soft')}
        >
          <ScoreDial score={aiScore} label={t('score')} />
          <div className="mt-4 flex flex-wrap justify-center gap-2" data-testid="criteria">
            {ai.perCriterion.map((c) => (
              <span
                key={c.criterion}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[12px] border-2 bg-card px-3 py-1.5 text-sm font-black',
                  c.score >= 70 ? 'border-cedar/50 text-cedar-ink dark:text-cedar' : c.score >= 50 ? 'border-med/50 text-med-ink dark:text-med' : 'border-flag/50 text-flag-d dark:text-danger',
                )}
              >
                {c.score >= 70 ? '✓' : '•'} {c.criterion}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-end gap-3">
            <Arzino mood={aiMood} size={96} />
            <div className="relative mb-3 flex-1 rounded-[20px] rounded-es-md border-2 border-border bg-card px-4 py-3 shadow-[0_4px_0_var(--border)]">
              <p className="eyebrow">{t('arzinoSays')}</p>
              <p className="mt-0.5 font-semibold leading-snug" data-testid="ai-feedback">
                {ai.feedback}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Mandatory follow-up question */}
      {s.status === 'AI_CHECKED' && ai && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="chunky rounded-[24px] border-med/50 p-5 shadow-[0_4px_0_var(--med)]">
            <div className="flex items-center gap-3">
              <Arzino mood="starry-eyed" size={110} className="shrink-0" />
              <div className="min-w-0">
                <p className="eyebrow !text-med-ink dark:!text-med">{t('followUpTitle')}</p>
                <p className="mt-1 font-display text-xl font-black leading-snug" data-testid="follow-up-question">
                  {ai.followUpQuestion}
                </p>
                <p className="mt-1 text-sm font-bold text-muted-foreground">{t('followUpSub')}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <VoiceInput onTranscript={(text) => setAnswer(text)} />
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t('answerPlaceholder')} className="text-base" data-testid="follow-up-answer" />
              <Button
                variant="kidMint"
                size="lg"
                className="w-full"
                disabled={!answer.trim()}
                loading={busy}
                onClick={() => act(() => api(`/submissions/${s.id}/follow-up`, { body: { answer: answer.trim() } }))}
                data-testid="send-follow-up"
              >
                {t('answer')} <ArrowRight className="rtl-flip" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {s.aiFollowUpCheck && s.status !== 'AI_CHECKED' && (
        <div className="chunky rounded-[20px] p-4">
          <p className="text-sm font-black text-muted-foreground">{ai?.followUpQuestion}</p>
          <p className="mt-1 font-semibold italic">“{s.followUpAnswer}”</p>
          <p className={cn('mt-2 font-black', s.aiFollowUpCheck.understood ? 'text-cedar-ink dark:text-cedar' : 'text-med-ink dark:text-med')}>
            {s.aiFollowUpCheck.understood ? '✓ ' : ''}
            {s.aiFollowUpCheck.feedback}
          </p>
        </div>
      )}

      {s.status === 'PEER_REVIEW' && s.peer && (
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
          <div className="flex flex-col items-center gap-3 rounded-[24px] bg-med p-6 text-center text-white shadow-[0_6px_0_var(--med-d)]" data-testid="sent-to-peer">
            <div className="flex items-center gap-2">
              <Arzino mood="clipboard" size={130} />
              <motion.span animate={{ x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="rtl-flip text-4xl" aria-hidden>
                📨
              </motion.span>
              <Avatar name={s.peer.evaluatorFirstName} src={s.peer.evaluatorAvatarUrl} className="size-20 border-4 border-white text-2xl" />
            </div>
            <p className="font-display text-[26px] font-black leading-tight">{t('sentToPeer', { name: s.peer.evaluatorFirstName })}</p>
            <p className="font-semibold text-white/90">{t('sentToPeerBody', { name: s.peer.evaluatorFirstName })}</p>
          </div>
        </motion.div>
      )}
      {s.status === 'TEACHER_REVIEW' && (
        <div className="chunky flex flex-col items-center gap-2 rounded-[24px] p-6 text-center" data-testid="sent-to-teacher">
          <Arzino mood="teaching" size={150} />
          <p className="font-display text-2xl font-black">{t('teacherReview')}</p>
          <p className="font-semibold text-muted-foreground">{t('teacherReviewBody')}</p>
        </div>
      )}
      {s.status === 'FAMILY_CONFIRM' && (
        <div className="flex flex-col items-center gap-2 rounded-[24px] border-2 border-flame/40 bg-flame-soft p-6 text-center" data-testid="family-confirm">
          <Arzino mood="warm" size={150} />
          <p className="font-display text-2xl font-black">{t('familyConfirm')}</p>
          <p className="font-semibold text-muted-foreground">{t('familyConfirmBody')}</p>
        </div>
      )}

      {s.status === 'RETRY' && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          className="rounded-[24px] border-2 border-flag/30 bg-flag-soft p-6 text-center"
          data-testid="retry-card"
        >
          <Arzino mood="try-again" size={170} className="mx-auto" />
          <p className="mt-2 font-display text-[26px] font-black leading-tight text-flag-d dark:text-danger">{t('almost')}</p>
          <p className="font-semibold text-muted-foreground">{t('almostBody')}</p>
          {s.teacherReview?.comment && <p className="mt-3 rounded-[16px] border-2 border-border bg-card p-3 text-start font-bold">“{s.teacherReview.comment}”</p>}
          {s.peer?.comment && <p className="mt-3 rounded-[16px] border-2 border-border bg-card p-3 text-start font-bold">“{s.peer.comment}”</p>}
          <Button variant="kidCoral" size="lg" className="mt-5 w-full" onClick={retry} loading={busy} data-testid="try-again">
            <RefreshCw /> {t('tryAgain')}
          </Button>
        </motion.div>
      )}

      {/* Peer feedback + helpfulness rating */}
      {s.peer && s.peer.status === 'DONE' && (
        <div className="chunky rounded-[20px] p-5" data-testid="peer-feedback">
          <div className="flex items-center gap-3">
            <Avatar name={s.peer.evaluatorFirstName} src={s.peer.evaluatorAvatarUrl} className="size-12" />
            <p className="flex-1 font-black">{t('peerFeedback', { name: s.peer.evaluatorFirstName })}</p>
            {s.peer.score != null && <Badge variant={s.peer.score >= 70 ? 'mint' : s.peer.score >= 50 ? 'sky' : 'coral'}>{s.peer.score}/100</Badge>}
          </div>
          {s.peer.comment && <p className="mt-3 text-lg font-semibold">“{s.peer.comment}”</p>}
          <div className="mt-4 border-t-2 border-border pt-4">
            <p className="text-sm font-black">{t('rateReview', { name: s.peer.evaluatorFirstName })}</p>
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
                    className="p-1 transition-transform hover:scale-110 disabled:hover:scale-100"
                    aria-label={`${n}`}
                    data-testid={`rate-${n}`}
                  >
                    <Star className={cn('size-10', n <= value ? 'fill-[#FFC21A] text-[#E0A800]' : 'text-lock-d')} />
                  </button>
                );
              })}
            </div>
            {(rated || s.peer.helpfulRating) && <p className="mt-1 text-sm font-black text-cedar-ink dark:text-cedar">{t('thanksRating')}</p>}
          </div>
        </div>
      )}

      {s.photoUploadIds.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {s.photoUploadIds.map((pid) => (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated upload
            <img key={pid} src={uploadUrl(pid)} alt="" className="aspect-square w-full rounded-[18px] border-2 border-border object-cover shadow-[0_4px_0_var(--border)]" />
          ))}
        </div>
      )}

      {err && <p className="rounded-[16px] border-2 border-flag/40 bg-flag-soft p-3 text-center font-bold text-flag-d dark:text-danger">{err}</p>}

      <Button asChild variant={validated ? 'kid' : 'kidGhost'} size="lg" className="w-full">
        <Link href="/student/missions">{t('backToMissions')}</Link>
      </Button>
    </div>
  );
}

const TONES = {
  med: { box: 'border-med', head: 'bg-med', text: 'text-med-ink dark:text-med' },
  cedar: { box: 'border-cedar', head: 'bg-cedar', text: 'text-cedar-ink dark:text-cedar' },
  flag: { box: 'border-flag', head: 'bg-flag', text: 'text-flag-d dark:text-danger' },
} as const;

/** Lesson-complete tile: colored header label + big number. */
function ScoreTile({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONES }) {
  const c = TONES[tone];
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.5 }} className={cn('overflow-hidden rounded-[16px] border-2 bg-card', c.box)}>
      <p className={cn('truncate px-2 py-1 text-center text-[11px] font-black uppercase tracking-[0.09em] text-white', c.head)}>{label}</p>
      <p className={cn('py-3 text-center font-display text-2xl font-black', c.text)}>{value}</p>
    </motion.div>
  );
}
