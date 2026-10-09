'use client';

import { ArrowLeft, ArrowRight, Check, Clock, HelpCircle, Send, ShieldCheck, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Arzino, ArzinoSays } from '@/components/arzino';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { VisualSpecView } from '@/components/kid/visual-spec';
import { FocusTop, LessonHeader } from '@/components/student/focus-top';
import { PhotoPicker } from '@/components/student/photo-picker';
import { TopicGlyph } from '@/components/app/subject-icon';
import { subjectStyle } from '@/components/student/subject-style';
import { VoiceInput } from '@/components/student/voice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const allDone = step === 2 && steps.length > 0 && checked.length >= steps.length;
  const stepLabel = (
    <span data-testid="step-label">
      {step + 1}/4 · {t(STEPS[step])}
    </span>
  );
  const next = () => {
    if (step < 3) go(step + 1);
    else submit();
  };
  const nextLabel = [t('startMission'), t('gotIt'), t('imReady'), t('submit')][step];

  return (
    <div className="pb-44">
      <FocusTop href="/student/map" progress={(step + 1) / 4} color={st.hex} />

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }} className="mt-3 space-y-5">
          {step === 0 && (
            <>
              <LessonHeader
                art={<Arzino mood="reading" size={124} pop />}
                eyebrow={stepLabel}
                eyebrowClass={st.text}
                title={l(mission.title)}
                titleTestId="mission-title"
              />
              <div className="flex flex-wrap gap-2">
                <Badge variant="sky" className="px-3 py-1 text-sm">
                  ⚡ {ts('xp', { xp: mission.xpReward })}
                </Badge>
                <Badge variant="muted" className="px-3 py-1 text-sm">
                  <Clock /> {t('minutes', { n: mission.estimatedMin })}
                </Badge>
                <Badge variant="outline" className="px-3 py-1 text-sm">
                  {tc(`difficulty.${mission.difficulty}`)}
                </Badge>
                {mission.audience === 'FAMILY' && (
                  <Badge variant="sunny" className="px-3 py-1 text-sm">
                    <Users /> {ts('family')}
                  </Badge>
                )}
              </div>
              <div className="overflow-hidden rounded-[24px] border-2 border-border shadow-[0_4px_0_var(--border)]">
                <div className="relative flex h-44 items-center justify-center overflow-hidden text-[110px] sm:h-52" style={{ background: st.hex }} aria-hidden>
                  <span className="absolute -start-6 -top-8 text-[160px] opacity-15">
                    <TopicGlyph topicKey={mission.topic?.key} icon={mission.topic?.icon} />
                  </span>
                  <motion.span animate={{ y: [0, -8, 0], rotate: [0, -3, 3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} className="drop-shadow-[0_6px_0_rgba(0,0,0,0.15)]">
                    <TopicGlyph topicKey={mission.topic?.key} icon={mission.topic?.icon} />
                  </motion.span>
                  <span className="absolute bottom-3 start-4 rounded-[12px] bg-black/20 px-3 py-1 text-[12px] font-black uppercase tracking-[0.09em] text-white">{t('storyEyebrow')}</span>
                </div>
                <p className="bg-card p-5 text-[18px] font-semibold leading-relaxed">{l(mission.story)}</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <LessonHeader art={<Arzino mood="teaching" size={124} pop />} eyebrow={stepLabel} eyebrowClass={st.text} title={t('stepLesson')} sub={t('lessonEyebrow')} />
              {mission.miniLesson.visualSpec?.shapes?.length ? (
                <div className="chunky rounded-[24px] p-5">
                  <VisualSpecView spec={mission.miniLesson.visualSpec} className="mx-auto max-w-sm" />
                </div>
              ) : null}
              <div className="relative rounded-[24px] border-2 p-5 text-[18px] font-semibold leading-relaxed" style={{ borderColor: st.hex, background: `color-mix(in srgb, ${st.hex} 9%, var(--card))` }}>
                {l(mission.miniLesson.text)}
              </div>
              {mission.topic?.key === 'geo.similar' && (
                // the similar-triangles lesson, hands-on: move the sun and measure shadows (works on a laptop too)
                <Button asChild variant="kidSunny" className="w-full" data-testid="try-vr">
                  <Link href={`/vr?scene=shadow-lab&mission=${mission.id}`}>🥽 {t('tryVr')}</Link>
                </Button>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <LessonHeader art={<Arzino mood="determined" size={124} pop />} eyebrow={stepLabel} eyebrowClass={st.text} title={t('steps')} sub={t('tickSteps')} />
              <ol className="space-y-3">
                {steps.map((s, i) => {
                  const done = checked.includes(i);
                  return (
                    <li key={i}>
                      <button
                        onClick={() => setChecked((c) => (done ? c.filter((x) => x !== i) : [...c, i]))}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-[18px] border-2 p-4 text-start transition-[background,border-color,transform] active:translate-y-[3px]',
                          done ? 'border-cedar/60 bg-cedar-soft shadow-[0_4px_0_var(--cedar)]' : 'border-border bg-card shadow-[0_4px_0_var(--border)] hover:bg-muted',
                        )}
                        aria-pressed={done}
                      >
                        <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] border-2 font-display font-black', done ? 'border-cedar bg-cedar text-white' : 'border-border text-muted-foreground')}>
                          {done ? <Check className="size-5" strokeWidth={3.5} /> : i + 1}
                        </span>
                        <span className={cn('text-[17px] font-bold', done && 'text-cedar-ink dark:text-cedar')}>{s}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-start gap-2 rounded-[16px] border-2 border-cedar/40 bg-cedar-soft px-3 py-2 text-sm font-black text-cedar-ink dark:text-cedar" data-testid="safety-chip">
                  <ShieldCheck className="mt-px size-5 shrink-0" />
                  <span>
                    {t('safety')}: <span className="font-bold text-foreground">{l(mission.safetyNotes)}</span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-[16px] border-2 border-border bg-muted px-3 py-2 text-sm font-black">
                  <Clock className="size-4" /> {t('minutes', { n: mission.estimatedMin })}
                </span>
              </div>
            </>
          )}

          {step === 3 && sub && (
            <>
              <LessonHeader art={<Arzino mood="writing" size={124} pop />} eyebrow={stepLabel} eyebrowClass={st.text} title={t('stepProof')} sub={t('proofEyebrow')} />
              <section className="chunky rounded-[20px] p-4">
                <Label className="eyebrow">📸 {t('photos')}</Label>
                <p className="mb-3 mt-1 text-sm font-bold text-muted-foreground">{mission.proofSpec.photoHint ? l(mission.proofSpec.photoHint) : t('photosHint', { n: Math.max(1, mission.proofSpec.photos) })}</p>
                <PhotoPicker value={draft.photos} onChange={(photos) => setDraft((d) => ({ ...d, photos }))} />
              </section>

              {fields.length > 0 && (
                <section className="chunky rounded-[20px] p-4">
                  <Label className="eyebrow">🔢 {t('numbers')}</Label>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {fields.map((f) => (
                      // a field with a unit is a measurement (number keyboard); others are words like "yes/no" or "12 > 9" (full keyboard, full row)
                      <div key={f.key} className={f.unit ? undefined : 'col-span-2'}>
                        <label className="mb-1 block text-sm font-extrabold text-muted-foreground" htmlFor={`f-${f.key}`}>
                          {l(f.label)} {f.unit && <span>({f.unit})</span>}
                        </label>
                        <Input
                          id={`f-${f.key}`}
                          inputMode={f.unit ? 'decimal' : 'text'}
                          dir={f.unit ? 'ltr' : 'auto'}
                          value={draft.answers[f.key] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, answers: { ...d.answers, [f.key]: e.target.value } }))}
                          className="h-12 text-lg font-black"
                          data-testid={`field-${f.key}`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="chunky space-y-3 rounded-[20px] p-4">
                <Label htmlFor="explanation" className="eyebrow">
                  🗣️ {t('explanation')}
                </Label>
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
                {draft.audioId && <p className="text-sm font-black text-cedar-ink dark:text-cedar">{t('audioSaved')}</p>}
                <Textarea
                  id="explanation"
                  value={draft.explanation}
                  onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
                  placeholder={t('explanationPlaceholder')}
                  className="min-h-36 text-base"
                  data-testid="explanation"
                />
              </section>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {err && (
        <p className="mt-5 rounded-[16px] border-2 border-flag/40 bg-flag-soft p-3 text-center font-bold text-flag-d dark:text-danger" role="alert">
          {err}
        </p>
      )}

      {/* I'm stuck → hints 1..3 → ask a friend */}
      {step >= 2 && (
        <div className="mt-6 space-y-3">
          {showHints &&
            hints.map((h) => (
              <motion.div key={h.level} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                <ArzinoSays mood="thinking" size={76}>
                  <span className="eyebrow block !text-med-ink dark:!text-med">💡 {t('hint', { level: h.level })}</span>
                  <span className="font-semibold" data-testid="hint-text">
                    {h.text}
                  </span>
                </ArzinoSays>
              </motion.div>
            ))}
          {hintBusy && <Thinking />}
          {hints.length >= 3 && showHints ? (
            <div className="chunky space-y-3 rounded-[20px] p-4">
              <div className="flex items-center gap-3">
                <Arzino mood="warm" size={76} />
                <div>
                  <p className="font-display text-lg font-black">🙋 {t('askFriend')}</p>
                  <p className="text-sm font-semibold text-muted-foreground">{t('askFriendBody')}</p>
                </div>
              </div>
              {mission.classId && <AskFriend missionId={mission.id} topicId={mission.topicId} />}
            </div>
          ) : (
            <Button variant="kidGhost" className="w-full" onClick={askHint} loading={hintBusy} data-testid="im-stuck">
              <HelpCircle /> {hints.length ? t('nextHint') : t('stuck')} <span className="text-xs normal-case tracking-normal text-muted-foreground">· {t('hintsLeft', { n: 3 - hints.length })}</span>
            </Button>
          )}
        </div>
      )}

      {/* Bottom action bar; on the checklist it turns into a cedar "all done" feedback bar */}
      <motion.div
        className={cn('fixed inset-x-0 bottom-0 z-40 border-t-2 pb-[env(safe-area-inset-bottom)] transition-colors', allDone ? 'border-transparent bg-cedar-soft' : 'border-border bg-background')}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-4 sm:px-6">
          {step > 0 && (
            <Button variant="kidGhost" size="icon" className="h-14 w-14 shrink-0" onClick={() => go(step - 1)} aria-label={tc('back')}>
              <ArrowLeft className="rtl-flip" />
            </Button>
          )}
          <AnimatePresence>
            {allDone && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
                <Arzino mood="correct" size={72} />
                <div className="min-w-0">
                  <p className="font-display text-xl font-black text-cedar-ink dark:text-cedar">{t('allStepsDone')}</p>
                  <p className="text-sm font-bold text-muted-foreground">{t('allStepsDoneSub')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!allDone && <div className="hidden flex-1 sm:block" />}
          <Button
            variant={step === 3 ? 'kidMint' : 'kid'}
            size="lg"
            className="h-14 min-w-0 flex-1 sm:w-auto sm:min-w-[220px] sm:flex-none"
            onClick={next}
            loading={step === 3 && submitting}
            data-testid={step === 3 ? 'submit-proof' : 'mission-next'}
          >
            <span className="truncate">{nextLabel}</span>
            {step === 3 ? <Send className="rtl-flip" /> : step === 1 ? <Check /> : <ArrowRight className="rtl-flip" />}
          </Button>
        </div>
      </motion.div>

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur" role="status">
          <div className="flex flex-col items-center gap-3 text-center">
            <Arzino mood="thinking" size={220} />
            <p className="font-display text-2xl font-black">{t('submitting')}</p>
          </div>
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
