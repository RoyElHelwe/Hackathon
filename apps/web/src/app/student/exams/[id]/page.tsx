'use client';

import { questionCountFor } from '@tajriba/shared';
import { ArrowLeft, Eye, Headphones, Keyboard, Mic, Send, Square, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Arzino, type ArzinoMood } from '@/components/arzino';
import { CampusCanvas } from '@/components/campus/campus-canvas';
import { mmss, useCountdown } from '@/components/campus/use-countdown';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { fireConfetti } from '@/components/kid/celebrations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useSpeechToText, useTextToSpeech } from '@/lib/campus/speech';
import type { AttemptView, ExamTurn } from '@/lib/campus/types';
import { useRecorder } from '@/lib/campus/use-recorder';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useVoice } from '@/lib/campus/use-voice';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';

/** The student's feeling (detected by the AI) → how Arzino reacts. */
const ARZINO_FOR: Record<string, ArzinoMood> = { nervous: 'warm', confused: 'thinking', confident: 'cheer', happy: 'correct', calm: 'teaching', thinking: 'thinking' };

export default function ExamRoomPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('campus');
  const format = useFormatter();
  const path = `/exam-attempts/${id}`;
  const q = useApi<AttemptView>(path);
  const invalidate = useInvalidate();
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useSocketEvent<{ attemptId: string }>('exam:status', (d) => d.attemptId === id && void invalidate(path, '/exams/mine'));

  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const a = q.data;
  const when = (d: string) => format.dateTime(new Date(d), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const next = await api<AttemptView>(`${path}/start`, { method: 'POST' });
      setStarted(true);
      await invalidate('/exams/mine');
      q.refetch();
      void next;
    } catch (e) {
      setStartError(e instanceof ApiError ? e.message : t('errors.generic'));
    } finally {
      setStarting(false);
    }
  };

  if (a.status === 'NOT_STARTED') {
    const n = a.questionCount || questionCountFor(a.exam.durationMin);
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="mx-auto flex max-w-[680px] flex-col items-center gap-4 p-6 text-center sm:p-8" data-testid="exam-intro">
          <Arzino mood={a.exam.status === 'OPEN' ? 'teaching' : 'bored-waiting'} size={180} pop />
          <p className="eyebrow">{t('exam.introTitle')}</p>
          <h1 className="font-display text-3xl font-black md:text-[34px]">{a.exam.title}</h1>
          <p className="max-w-md text-muted-foreground">{t('exam.introBody', { n, min: a.exam.durationMin })}</p>
          <ul className="grid w-full max-w-md gap-2 text-start text-sm font-bold">
            {(
              [
                ['🎙️', 'exam.ruleRecorded', 'bg-flag-soft'],
                ['👀', 'exam.ruleWatch', 'bg-med-soft'],
                ['🔒', 'exam.ruleHidden', 'bg-cedar-soft'],
              ] as const
            ).map(([icon, key, bg]) => (
              <li key={key} className="flex items-center gap-3 rounded-[16px] border-2 border-border bg-card p-2.5 shadow-[0_3px_0_0_var(--border)]">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[12px] text-lg', bg)} aria-hidden>
                  {icon}
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
          {a.exam.status === 'OPEN' ? (
            <Button variant="kid" size="lg" className="w-full max-w-md" onClick={start} loading={starting} data-testid="start-interview">
              <Mic /> {t('exam.start')}
            </Button>
          ) : a.exam.status === 'SCHEDULED' ? (
            <p className="rounded-full bg-med-soft px-4 py-2 font-black text-med-ink dark:text-white">{t('exam.notOpen', { date: when(a.exam.opensAt) })}</p>
          ) : (
            <p className="font-bold text-muted-foreground">{t('exam.closed')}</p>
          )}
          {startError && <p className="text-sm font-semibold text-danger">{startError}</p>}
        </Card>
      </div>
    );
  }

  if (a.status === 'IN_PROGRESS') return <Interview attempt={a} activated={started} onChange={() => q.refetch()} />;

  if (a.status === 'MISSED') {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="mx-auto flex max-w-[680px] flex-col items-center gap-3 p-6 text-center sm:p-8">
          <Arzino mood="sad" size={160} />
          <h1 className="font-display text-3xl font-black">{t('exam.missedTitle')}</h1>
          <p className="text-muted-foreground">{t('exam.missedBody')}</p>
        </Card>
      </div>
    );
  }

  return <Finished attempt={a} />;
}

function BackLink() {
  const t = useTranslations('campus');
  return (
    <Button asChild variant="kidGhost" size="sm">
      <Link href="/student/campus">
        <ArrowLeft className="rtl-flip" /> {t('exam.back')}
      </Link>
    </Button>
  );
}

function Finished({ attempt }: { attempt: AttemptView }) {
  const t = useTranslations('campus');
  const r = attempt.result;
  useEffect(() => {
    fireConfetti(attempt.status === 'RELEASED');
  }, [attempt.status]);
  return (
    <div className="space-y-4">
      <BackLink />
      {r ? (
        <Card className="space-y-4 p-6" data-testid="exam-result">
          <div className="flex flex-wrap items-center gap-4">
            <Arzino mood={(r.score ?? 0) >= 70 ? 'trophy' : (r.score ?? 0) >= 50 ? 'proud' : 'determined'} size={150} pop />
            <div>
              <p className="eyebrow">{t('exam.resultTitle')}</p>
              <p className={cn('font-display text-6xl font-black', (r.score ?? 0) >= 70 ? 'text-cedar' : (r.score ?? 0) >= 50 ? 'text-med' : 'text-flag')}>
                {r.score ?? '–'}
                <span className="text-2xl text-muted-foreground">/100</span>
              </p>
            </div>
          </div>
          {r.teacherComment && (
            <p className="rounded-[16px] border-2 border-med/30 bg-med-soft p-3 text-sm">
              <b>{t('exam.teacherComment')}:</b> {r.teacherComment}
            </p>
          )}
          {r.feedback && (
            <p className="text-sm">
              <b>{t('exam.feedback')}:</b> {r.feedback}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {r.strengths.length > 0 && (
              <div>
                <p className="eyebrow !text-success">{t('exam.strengths')}</p>
                <ul className="list-disc ps-5 text-sm">{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
            {r.gaps.length > 0 && (
              <div>
                <p className="eyebrow !text-flag">{t('exam.gaps')}</p>
                <ul className="list-disc ps-5 text-sm">{r.gaps.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="mx-auto flex max-w-[680px] flex-col items-center gap-3 p-6 text-center sm:p-8" data-testid="exam-done">
          <Arzino mood="celebrate" size={180} pop />
          <h1 className="font-display text-3xl font-black md:text-[34px]">{t('exam.doneTitle')}</h1>
          <p className="text-muted-foreground">{t('exam.doneBody')}</p>
        </Card>
      )}
      <Transcript turns={attempt.turns} />
    </div>
  );
}

function Transcript({ turns, live }: { turns: ExamTurn[]; live?: string }) {
  const t = useTranslations('campus');
  const end = useRef<HTMLDivElement>(null);
  // braces: newer Chrome returns a Promise from scrollIntoView, which React would take as the effect's cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [turns.length]);
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-display text-xl font-black">{t('exam.transcript')}</h2>
      <ol className="max-h-80 space-y-2 overflow-y-auto pe-1" data-testid="exam-transcript">
        {turns.map((turn) => (
          <li key={turn.idx} className={cn('flex gap-2', turn.role === 'STUDENT' && 'flex-row-reverse')}>
            <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg" aria-hidden>
              {turn.role === 'AI' ? turn.emoji || '🌲' : '🗣️'}
            </span>
            <p className={cn('max-w-[85%] rounded-[18px] border-2 px-3 py-2 text-sm', turn.role === 'AI' ? 'rounded-ss-md border-cedar/25 bg-cedar-soft' : 'rounded-se-md border-med/25 bg-med-soft')}>
              <span className="block text-[11px] font-black uppercase tracking-wider opacity-60">{turn.role === 'AI' ? t('exam.arzino') : t('exam.you')}</span>
              {turn.text}
            </p>
          </li>
        ))}
        {live && (
          <li className="flex flex-row-reverse gap-2 opacity-70">
            <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">🎙️</span>
            <p className="max-w-[85%] rounded-[18px] border-2 border-dashed border-med px-3 py-2 text-sm italic">{live}</p>
          </li>
        )}
      </ol>
      <div ref={end} />
    </Card>
  );
}

function Interview({ attempt: initial, activated: initiallyActivated, onChange }: { attempt: AttemptView; activated: boolean; onChange: () => void }) {
  const t = useTranslations('campus');
  const [attempt, setAttempt] = useState(initial);
  const [activated, setActivated] = useState(initiallyActivated);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [spokenIdx, setSpokenIdx] = useState(-1);
  const locale = attempt.exam.locale;
  const room = useRoom(attempt.room);
  const voice = useVoice({ room: attempt.room, selfId: attempt.studentId, publishes: room.publishes, peers: room.players, joined: room.status === 'joined' });
  const rec = useRecorder({ kind: 'EXAM', refId: attempt.id, stream: voice.stream, active: activated });
  const stt = useSpeechToText(locale);
  const tts = useTextToSpeech(locale);
  const left = useCountdown(attempt.endsAt);
  const observed = room.players.some((p) => p.spectator);
  const listener = room.players.find((p) => p.spectator && p.listening);
  const lastAi = [...attempt.turns].reverse().find((x) => x.role === 'AI');
  const { enable, enabled } = voice;

  useEffect(() => setAttempt(initial), [initial]);

  // Mic for the teacher's live listening + recording; needs the click that "activated" the room.
  useEffect(() => {
    if (activated && room.status === 'joined' && room.publishes && !enabled) void enable(true);
  }, [activated, room.status, room.publishes, enabled, enable]);

  // Arzino speaks each new question, then we listen for the answer.
  const { speak } = tts;
  const { start: listen, supported: canListen } = stt;
  useEffect(() => {
    if (!activated || !lastAi || lastAi.idx <= spokenIdx || thinking) return;
    setSpokenIdx(lastAi.idx);
    void speak(lastAi.text).then(() => {
      if (canListen && !typing) listen();
    });
  }, [activated, lastAi, spokenIdx, thinking, speak, listen, canListen, typing]);

  // Speaking ring for watching teachers (Exam Hall + live view).
  const { speaking: emitSpeaking } = room;
  useEffect(() => {
    emitSpeaking(voice.speaking);
  }, [voice.speaking, emitSpeaking]);

  // Live transcript for a watching teacher.
  const { transcript: sendTranscript } = room;
  useEffect(() => {
    if (stt.transcript) sendTranscript(stt.transcript);
  }, [stt.transcript, sendTranscript]);

  // Time is up → the server finishes the interview.
  useEffect(() => {
    if (left === 0) {
      tts.cancel();
      stt.stop();
      const to = window.setTimeout(onChange, 1500);
      return () => window.clearTimeout(to);
    }
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to the clock reaching 0

  const submit = useCallback(async () => {
    const text = (stt.stop() || stt.transcript).trim();
    if (!text || thinking) return;
    tts.cancel();
    setThinking(true);
    setError(null);
    try {
      const next = await api<AttemptView>(`/exam-attempts/${attempt.id}/answer`, { body: { text } });
      stt.reset();
      setAttempt(next);
      if (next.status !== 'IN_PROGRESS') {
        rec.stop();
        onChange();
      }
    } catch (e) {
      // The answer is kept: "Try again" resends it.
      setError(e instanceof ApiError && e.status !== 503 ? e.message : t('exam.retry'));
      stt.setText(text);
    } finally {
      setThinking(false);
    }
  }, [stt, thinking, tts, attempt.id, rec, onChange, t]);

  const finish = async () => {
    setConfirm(false);
    tts.cancel();
    stt.stop();
    rec.stop();
    await api(`/exam-attempts/${attempt.id}/finish`, { method: 'POST' }).catch(() => undefined);
    onChange();
  };

  const mood: ArzinoMood = thinking ? 'thinking' : stt.listening ? 'starry-eyed' : ARZINO_FOR[lastAi?.mood ?? 'calm'] ?? 'teaching';
  const qn = Math.min(attempt.questionIdx + 1, attempt.questionCount);
  const timer = left !== null && (
    <span className={cn('rounded-full px-3 py-1.5 font-mono text-sm font-black', left < 60 ? 'animate-pulse bg-flag text-white' : 'bg-med text-white')} data-testid="exam-timer">
      ⏱ {t('exam.timeLeft', { time: mmss(left) })}
    </span>
  );

  return (
    <div className="space-y-4" data-testid="exam-room">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-black">{attempt.exam.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: attempt.questionCount }, (_, i) => (
                <span key={i} className={cn('h-2.5 w-6 rounded-full', i < qn - 1 ? 'bg-cedar' : i === qn - 1 ? 'bg-med' : 'bg-lock')} />
              ))}
            </div>
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground" data-testid="question-progress">
              {t('exam.question', { n: qn, total: attempt.questionCount })}
            </p>
          </div>
        </div>
        {timer}
        {rec.recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-flag-soft px-3 py-1.5 text-xs font-black uppercase tracking-wider text-flag-d dark:text-danger">
            <span className="size-2 animate-pulse rounded-full bg-flag" /> {t('study.recording')}
          </span>
        )}
      </div>
      {listener ? (
        <p className="flex items-center gap-2 rounded-[14px] border-2 border-cedar/30 bg-cedar-soft px-3 py-2 text-sm font-bold text-cedar-ink dark:text-success" data-testid="teacher-listening">
          <Headphones className="size-4" /> {t('exam.listeningNow', { name: listener.name })}
        </p>
      ) : (
        observed && (
          <p className="flex items-center gap-2 rounded-[14px] border-2 border-med/30 bg-med-soft px-3 py-2 text-sm font-bold text-med-ink dark:text-white" data-testid="observed">
            <Eye className="size-4" /> {t('exam.observed')}
          </p>
        )
      )}

      <div className="grid items-start gap-4 md:grid-cols-[1fr_1.1fr]">
        <CampusCanvas room={room} map="exam" interactive={false} className="aspect-[18/13] w-full" selfSpeaking={voice.speaking}>
          {(fs) =>
            fs.full && (
              <>
                <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-center gap-2 pe-14">
                  <span className="rounded-full border-2 border-border bg-card/95 px-3 py-1.5 font-display text-sm font-black shadow-[0_3px_0_0_var(--border)]">{t('exam.question', { n: qn, total: attempt.questionCount })}</span>
                  {left !== null && <span className={cn('rounded-full px-3 py-1.5 font-mono text-sm font-black text-white', left < 60 ? 'bg-flag' : 'bg-med')}>⏱ {mmss(left)}</span>}
                </div>
                <div className="absolute inset-x-3 bottom-3 mx-auto flex max-w-2xl items-end gap-3 rounded-[24px] border-2 border-border bg-card/95 p-3 shadow-[0_4px_0_0_var(--border)] backdrop-blur">
                  <Arzino mood={mood} size={96} />
                  <div className="min-w-0 flex-1 space-y-2">
                    {thinking ? <p className="font-display text-lg font-black text-muted-foreground">{t('exam.thinking')}</p> : <p className="font-display text-lg font-black leading-snug">{lastAi?.text}</p>}
                    {activated && stt.supported && (
                      <div className="flex flex-wrap items-center gap-2">
                        {stt.listening ? (
                          <Button variant="kidMint" onClick={submit} disabled={thinking || !stt.transcript}>
                            <Square /> {t('exam.done')}
                          </Button>
                        ) : (
                          <Button variant="kid" onClick={() => stt.start()} disabled={thinking}>
                            <Mic /> {t('exam.answer')}
                          </Button>
                        )}
                        {stt.transcript && <span className="line-clamp-1 min-w-0 flex-1 text-sm italic text-muted-foreground">{stt.transcript}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )
          }
        </CampusCanvas>
        <Card className="relative flex flex-col items-center gap-3 p-4 text-center">
          <div className="relative">
            <Arzino mood={mood} size={170} />
            <AnimatePresence mode="popLayout">
              {lastAi?.emoji && !thinking && (
                <motion.span
                  key={lastAi.idx}
                  initial={{ scale: 0, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                  className="absolute -end-6 -top-2 flex size-16 items-center justify-center rounded-full border-2 border-border bg-card text-4xl shadow-[0_4px_0_0_var(--border)]"
                  data-testid="arzino-emoji"
                >
                  {lastAi.emoji}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="relative w-full rounded-[20px] border-2 border-cedar/30 bg-cedar-soft p-4 text-start" aria-live="polite">
            <span className="absolute -top-2.5 start-1/2 size-4 -translate-x-1/2 rotate-45 border-s-2 border-t-2 border-cedar/30 bg-cedar-soft rtl:translate-x-1/2" aria-hidden />
            {thinking ? <Thinking label={t('exam.thinking')} className="py-2" /> : <p className="font-display text-xl font-black leading-snug" data-testid="arzino-says">{lastAi?.text}</p>}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="kidGhost" size="sm" onClick={() => lastAi && void tts.speak(lastAi.text)} disabled={!lastAi || thinking}>
              <Volume2 /> {t('exam.hearAgain')}
            </Button>
            <Button variant="kidGhost" size="sm" onClick={() => tts.setMuted(!tts.muted)} aria-pressed={tts.muted}>
              {tts.muted ? <VolumeX /> : <Volume2 />} {tts.muted ? t('exam.unmute') : t('exam.mute')}
            </Button>
          </div>
        </Card>
      </div>

      {!activated ? (
        <Button variant="kid" size="lg" className="w-full" onClick={() => setActivated(true)} data-testid="resume-interview">
          <Mic /> {t('exam.start')}
        </Button>
      ) : (
        <Card className="space-y-3 border-med p-4 shadow-[0_4px_0_0_var(--med-d)]">
          {!stt.supported && <p className="text-sm text-muted-foreground">{t('exam.sttUnsupported')}</p>}
          {stt.supported && !typing ? (
            <div className="space-y-2">
              <p className={cn('min-h-14 rounded-[16px] border-2 border-dashed p-3 text-base font-semibold', stt.listening ? 'border-med bg-med-soft' : 'border-border')} data-testid="live-answer">
                {stt.transcript || <span className="text-muted-foreground">{stt.listening ? t('exam.listening') : t('exam.yourAnswer')}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {stt.listening ? (
                  <Button variant="kidMint" size="lg" onClick={submit} disabled={thinking || !stt.transcript} data-testid="done-answering">
                    <Square /> {t('exam.done')}
                  </Button>
                ) : (
                  <Button variant="kid" size="lg" onClick={() => stt.start()} disabled={thinking} data-testid="answer-voice">
                    <Mic /> {t('exam.answer')}
                  </Button>
                )}
                {!stt.listening && stt.transcript && (
                  <Button variant="kidMint" size="lg" onClick={submit} loading={thinking}>
                    <Send /> {t('exam.send')}
                  </Button>
                )}
                <Button variant="kidGhost" onClick={() => { stt.stop(); setTyping(true); }} data-testid="type-instead">
                  <Keyboard /> {t('exam.typeInstead')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea value={stt.transcript} onChange={(e) => stt.setText(e.target.value)} placeholder={t('exam.typePlaceholder')} rows={3} data-testid="typed-answer" />
              <div className="flex flex-wrap gap-2">
                <Button variant="kidMint" onClick={submit} loading={thinking} disabled={!stt.transcript.trim()} data-testid="send-answer">
                  <Send /> {t('exam.send')}
                </Button>
                {stt.supported && (
                  <Button variant="kidGhost" onClick={() => setTyping(false)}>
                    <Mic /> {t('exam.answer')}
                  </Button>
                )}
              </div>
            </div>
          )}
          {error && (
            <p className="flex items-center gap-2 text-sm font-semibold text-danger">
              {error}
              <Button size="sm" variant="outline" onClick={submit}>
                {t('exam.retry')}
              </Button>
            </p>
          )}
        </Card>
      )}

      <Transcript turns={attempt.turns} live={stt.listening ? stt.transcript : undefined} />

      <div className="flex justify-end">
        <Button variant="kidGhost" onClick={() => setConfirm(true)} data-testid="finish-interview">
          {t('exam.finish')}
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <div className="flex justify-center">
            <Arzino mood="shocked" size={110} />
          </div>
          <DialogTitle>{t('exam.finishTitle')}</DialogTitle>
          <DialogDescription>{t('exam.finishBody')}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="kidGhost" onClick={() => setConfirm(false)}>
              {t('exam.keepGoing')}
            </Button>
            <Button variant="kid" onClick={finish} data-testid="confirm-finish">
              {t('exam.finish')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
