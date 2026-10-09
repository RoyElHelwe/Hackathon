'use client';

import { ArrowLeft, ArrowRight, Check, Clock, HelpCircle, ShieldCheck, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Bousla, BouslaSays } from '@/components/bousla';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { VisualSpecView } from '@/components/kid/visual-spec';
import { PhotoPicker } from '@/components/student/photo-picker';
import { TopicGlyph } from '@/components/app/subject-icon';
import { subjectStyle } from '@/components/student/subject-style';
import { VoiceInput } from '@/components/student/voice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, ApiError, uploadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useL } from '@/lib/hooks';
import type { Classmate } from '@/lib/campus/types';
import type { Mission, Submission } from '@/lib/types';

const STEPS = ['stepStory', 'stepLesson', 'stepMission', 'stepProof'] as const;

interface Draft {
  photos: string[];
  answers: Record<string, string>;
  explanation: string;
  audioId: string | null;
}
const emptyDraft: Draft = { photos: [], answers: {}, explanation: '', audioId: null };

function loadDraft(subId: string): Draft {
  try {
    return { ...emptyDraft, ...JSON.parse(localStorage.getItem(`tj-draft-${subId}`) ?? '{}') };
  } catch {
    return emptyDraft;
  }
}

export default function MissionPage() {
  const t = useTranslations('mission');
  const ts = useTranslations('student');
  const tc = useTranslations('common');
  const l = useL();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { id } = useParams<{ id: string }>();
  const { data: mission, isLoading, error, refetch } = useApi<Mission>(`/missions/${id}`);
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState<Submission | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [checked, setChecked] = useState<number[]>([]);
  const [hints, setHints] = useState<{ level: number; text: string }[]>([]);
  const [hintBusy, setHintBusy] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Redirect to the result page when this mission was already submitted.
  useEffect(() => {
    const s = mission?.mySubmission;
    if (s && s.status !== 'IN_PROGRESS') router.replace(`/student/submissions/${s.id}`);
    else if (s && step === 0 && !sub) {
      api<Submission>(`/submissions/${s.id}`).then((full) => {
        setSub(full);
        setHints(full.hints ?? []);
        setDraft(loadDraft(full.id));
      });
    }
  }, [mission, router, step, sub]);

  useEffect(() => {
    if (sub) localStorage.setItem(`tj-draft-${sub.id}`, JSON.stringify(draft));
  }, [draft, sub]);

  const ensureStarted = useCallback(async () => {
    if (sub) return sub;
    const s = await api<Submission>('/submissions', { body: { missionId: id } });
    setSub(s);
    setHints(s.hints ?? []);
    setDraft(loadDraft(s.id));
    return s;
  }, [id, sub]);

  const go = async (n: number) => {
    setErr(null);
    if (n >= 2) {
      try {
        await ensureStarted();
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : tc('error'));
        return;
      }
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const askHint = async () => {
    const s = await ensureStarted();
    setShowHints(true);
    if (hints.length >= 3) return;
    setHintBusy(true);
    try {
      const r = await api<{ level: number; hint: string }>(`/submissions/${s.id}/hint`, { body: { partialWork: draft.explanation || undefined } });
      setHints((h) => [...h, { level: r.level, text: r.hint }]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : tc('error'));
    } finally {
      setHintBusy(false);
    }
  };

  const submit = async () => {
    if (!sub || !mission) return;
    if (!draft.photos.length && !draft.explanation.trim()) {
      setErr(t('needProof'));
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const answers = Object.fromEntries(Object.entries(draft.answers).filter(([, v]) => v !== '').map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)]));
      await api(`/submissions/${sub.id}/submit`, {
        body: { photoUploadIds: draft.photos, audioUploadId: draft.audioId, explanation: draft.explanation.trim() || null, answers },
      });
      localStorage.removeItem(`tj-draft-${sub.id}`);
      await invalidate('/missions', `/missions/${id}`, '/gamification/me');
      router.push(`/student/submissions/${sub.id}`);
    } catch (e) {
      // The work is saved even if the AI check failed: the result page offers "Check again".
      if (e instanceof ApiError && e.status === 503) router.push(`/student/submissions/${sub.id}`);
      else setErr(e instanceof ApiError ? e.message : tc('error'));
      setSubmitting(false);
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (error || !mission) return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} />;

  const st = subjectStyle(mission.topic?.subject?.key, mission.topic?.subject?.color, mission.topic?.subject?.icon);
  const steps = l(mission.steps) ?? [];
  const fields = mission.proofSpec.fields ?? [];

  return (
    <div className="space-y-5 pb-6">
      {/* progress */}
      <div className="flex items-center gap-2" aria-label="Progress">
        {STEPS.map((k, i) => (
          <button
            key={k}
            onClick={() => i <= step && go(i)}
            className={cn('h-2.5 flex-1 rounded-full transition-colors', i <= step ? st.bg : 'bg-muted')}
            aria-label={t(k)}
            aria-current={i === step}
          />
        ))}
      </div>
      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground" data-testid="step-label">
        {step + 1}/4 · {t(STEPS[step])}
      </p>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          {step === 0 && (
            <div className="space-y-5">
              <div className={cn('relative flex h-56 items-end overflow-hidden rounded-[28px] p-5', 'bg-gradient-to-br from-sky via-violet to-[#8B6CFF]')}>
                <div className="absolute inset-0 flex items-center justify-center text-[130px] opacity-90" aria-hidden>
                  <TopicGlyph topicKey={mission.topic?.key} icon={mission.topic?.icon} />
                </div>
                <div className="absolute end-3 top-3">
                  <Bousla mood="curious" size={70} />
                </div>
                <div className="relative flex flex-wrap gap-2">
                  <Badge className="bg-white/90 text-ink">⚡ {ts('xp', { xp: mission.xpReward })}</Badge>
                  <Badge className="bg-white/90 text-ink">
                    <Clock /> {t('minutes', { n: mission.estimatedMin })}
                  </Badge>
                  <Badge className="bg-white/90 text-ink">{tc(`difficulty.${mission.difficulty}`)}</Badge>
                  {mission.audience === 'FAMILY' && (
                    <Badge className="bg-white/90 text-ink">
                      <Users /> {ts('family')}
                    </Badge>
                  )}
                </div>
              </div>
              <h1 className="font-display text-3xl font-extrabold leading-tight" data-testid="mission-title">
                {l(mission.title)}
              </h1>
              <p className="text-lg leading-relaxed">{l(mission.story)}</p>
              <Button variant="kid" size="pill" className="w-full" onClick={() => go(1)} data-testid="mission-next">
                {t('startMission')} <ArrowRight className="rtl-flip" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-extrabold">{t('stepLesson')} ⏱️</h2>
              <Card className="p-5">
                <VisualSpecView spec={mission.miniLesson.visualSpec} className="mx-auto max-w-sm" />
              </Card>
              <BouslaSays mood="happy" size={64}>
                <span className="font-normal">{l(mission.miniLesson.text)}</span>
              </BouslaSays>
              {mission.topic?.key === 'geo.similar' && (
                // the similar-triangles lesson, hands-on: move the sun and measure shadows (works on a laptop too)
                <Button asChild variant="kidSunny" className="w-full" data-testid="try-vr">
                  <Link href={`/vr?scene=shadow-lab&mission=${mission.id}`}>🥽 {t('tryVr')}</Link>
                </Button>
              )}
              <Button variant="kid" size="pill" className="w-full" onClick={() => go(2)} data-testid="mission-next">
                {t('gotIt')} <Check />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-extrabold">{t('steps')}</h2>
              <ol className="space-y-3">
                {steps.map((s, i) => {
                  const done = checked.includes(i);
                  return (
                    <li key={i}>
                      <button
                        onClick={() => setChecked((c) => (done ? c.filter((x) => x !== i) : [...c, i]))}
                        className={cn('flex w-full items-start gap-3 rounded-[18px] border-2 p-4 text-start transition-colors', done ? 'border-mint bg-mint-soft' : 'border-border bg-card')}
                        aria-pressed={done}
                      >
                        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full font-display font-extrabold', done ? 'bg-mint text-ink' : 'bg-muted')}>
                          {done ? <Check className="size-5" /> : i + 1}
                        </span>
                        <span className={cn('text-base font-semibold', done && 'line-through opacity-70')}>{s}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-[14px] bg-mint-soft px-3 py-2 text-sm font-bold text-success" data-testid="safety-chip">
                  <ShieldCheck className="size-5" /> {t('safety')}: <span className="font-semibold text-foreground">{l(mission.safetyNotes)}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-[14px] bg-muted px-3 py-2 text-sm font-bold">
                  <Clock className="size-4" /> {t('minutes', { n: mission.estimatedMin })}
                </span>
              </div>
              <Button variant="kid" size="pill" className="w-full" onClick={() => go(3)} data-testid="mission-next">
                {t('imReady')} <ArrowRight className="rtl-flip" />
              </Button>
            </div>
          )}

          {step === 3 && sub && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-extrabold">{t('stepProof')} 📸</h2>
              <section>
                <Label>{t('photos')}</Label>
                <p className="mb-2 text-sm text-muted-foreground">{mission.proofSpec.photoHint ? l(mission.proofSpec.photoHint) : t('photosHint', { n: Math.max(1, mission.proofSpec.photos) })}</p>
                <PhotoPicker value={draft.photos} onChange={(photos) => setDraft((d) => ({ ...d, photos }))} />
              </section>

              {fields.length > 0 && (
                <section>
                  <Label>{t('numbers')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map((f) => (
                      // a field with a unit is a measurement (number keyboard); others are words like "yes/no" or "12 > 9" (full keyboard, full row)
                      <div key={f.key} className={f.unit ? undefined : 'col-span-2'}>
                        <label className="mb-1 block text-sm font-semibold text-muted-foreground" htmlFor={`f-${f.key}`}>
                          {l(f.label)} {f.unit && <span>({f.unit})</span>}
                        </label>
                        <Input
                          id={`f-${f.key}`}
                          inputMode={f.unit ? 'decimal' : 'text'}
                          dir={f.unit ? 'ltr' : 'auto'}
                          value={draft.answers[f.key] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [f.key]: e.target.value } }))}
                          className="text-lg font-bold"
                          data-testid={`field-${f.key}`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <Label htmlFor="explanation">{t('explanation')}</Label>
                <VoiceInput
                  onTranscript={(text) => setDraft((d) => ({ ...d, explanation: text }))}
                  onAudio={async (blob) => {
                    try {
                      const up = await uploadFile(blob, 'explanation.webm');
                      setDraft((d) => ({ ...d, audioId: up.id }));
                    } catch {
                      /* audio is optional evidence */
                    }
                  }}
                />
                {draft.audioId && <p className="text-sm font-semibold text-success">{t('audioSaved')}</p>}
                <Textarea
                  id="explanation"
                  value={draft.explanation}
                  onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
                  placeholder={t('explanationPlaceholder')}
                  className="min-h-36 text-base"
                  data-testid="explanation"
                />
              </section>

              <Button variant="kidMint" size="pill" className="w-full" onClick={submit} loading={submitting} data-testid="submit-proof">
                {t('submit')} 🧭
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {err && (
        <p className="rounded-[14px] bg-coral-soft p-3 text-center font-semibold text-danger" role="alert">
          {err}
        </p>
      )}

      {/* I'm stuck → hints 1..3 → ask a friend */}
      {step >= 2 && (
        <div className="space-y-3">
          {showHints &&
            hints.map((h) => (
              <motion.div key={h.level} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <BouslaSays mood="thinking" size={56}>
                  <span className="block text-xs font-extrabold uppercase text-primary">{t('hint', { level: h.level })}</span>
                  <span className="font-normal" data-testid="hint-text">
                    {h.text}
                  </span>
                </BouslaSays>
              </motion.div>
            ))}
          {hintBusy && <Thinking />}
          {hints.length >= 3 && showHints ? (
            <Card className="border-2 border-sunny bg-sunny-soft p-4">
              <p className="font-display text-lg font-extrabold">🙋 {t('askFriend')}</p>
              <p className="text-sm">{t('askFriendBody')}</p>
              {mission.classId && <AskFriend missionId={mission.id} topicId={mission.topicId} />}
            </Card>
          ) : (
            <Button variant="kidGhost" className="w-full" onClick={askHint} loading={hintBusy} data-testid="im-stuck">
              <HelpCircle /> {hints.length ? t('nextHint') : t('stuck')} <span className="text-sm text-muted-foreground">· {t('hintsLeft', { n: 3 - hints.length })}</span>
            </Button>
          )}
        </div>
      )}

      {step > 0 && (
        <button onClick={() => go(step - 1)} className="inline-flex items-center gap-2 font-bold text-muted-foreground">
          <ArrowLeft className="rtl-flip size-5" /> {tc('back')}
        </button>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur" role="status">
          <Thinking label={t('submitting')} />
        </div>
      )}
    </div>
  );
}

/**
 * "Ask a friend": classmates who mastered this topic come first. Asking opens a study room with this mission on the
 * Ideas board, so the friend can help right away.
 */
function AskFriend({ missionId, topicId }: { missionId: string; topicId: string }) {
  const t = useTranslations('mission');
  const router = useRouter();
  const mates = useApi<Classmate[]>(`/study-sessions/classmates?topicId=${encodeURIComponent(topicId)}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ask = async (partnerId: string) => {
    setBusy(partnerId);
    setErr(null);
    try {
      const s = await api<{ id: string }>('/study-sessions', { body: { partnerId, missionId } });
      router.push(`/student/study/${s.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.data.code === 'ALREADY_IN_SESSION' && e.data.sessionId) return router.push(`/student/study/${e.data.sessionId}`);
      setErr(e instanceof ApiError ? e.message : t('askFriendError'));
    } finally {
      setBusy(null);
    }
  };

  if (mates.isLoading) return <Thinking />;
  const list = (mates.data ?? []).slice(0, 4);
  if (!list.length) return <p className="mt-2 text-sm font-semibold">{t('askFriendNone')}</p>;
  return (
    <div className="mt-3 space-y-2">
      {!list.some((m) => m.mastered) && <p className="text-sm font-semibold">{t('askFriendNobody')}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      <ul className="space-y-2">
        {list.map((m) => (
          <li key={m.userId} className="flex items-center gap-2 rounded-[14px] bg-card p-2">
            <span className={cn('size-2.5 shrink-0 rounded-full', m.online ? 'bg-mint' : 'bg-muted-foreground/40')} aria-hidden />
            <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
            {m.mastered && <Badge variant="mint">{t('askFriendMastered')}</Badge>}
            <Button size="sm" variant="kid" loading={busy === m.userId} disabled={!!busy} onClick={() => ask(m.userId)} data-testid={`ask-friend-${m.name.split(' ')[0].toLowerCase()}`}>
              <Users /> {t('askFriendAsk')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
