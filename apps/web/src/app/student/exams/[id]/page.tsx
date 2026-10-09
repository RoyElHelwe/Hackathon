'use client';

import { questionCountFor } from '@tajriba/shared';
import { ArrowLeft, Eye, Keyboard, Mic, Send, Square, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bousla, type BouslaMood } from '@/components/bousla';
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

/** The student's feeling (detected by the AI) → how Bousla reacts. */
const BOUSLA_FOR: Record<string, BouslaMood> = { nervous: 'happy', confused: 'curious', confident: 'cheering', happy: 'cheering', calm: 'happy', thinking: 'thinking' };

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
        <Card className="flex flex-col items-center gap-4 p-6 text-center" data-testid="exam-intro">
          <Bousla mood="happy" size={110} />
          <h1 className="font-display text-3xl font-extrabold">{a.exam.title}</h1>
          <h2 className="font-display text-xl font-bold text-primary">{t('exam.introTitle')}</h2>
          <p className="max-w-md text-muted-foreground">{t('exam.introBody', { n, min: a.exam.durationMin })}</p>
          <ul className="space-y-1.5 text-start text-sm font-semibold">
            <li>🎙️ {t('exam.ruleRecorded')}</li>
            <li>👀 {t('exam.ruleWatch')}</li>
            <li>🔒 {t('exam.ruleHidden')}</li>
          </ul>
          {a.exam.status === 'OPEN' ? (
            <Button variant="kid" size="lg" onClick={start} loading={starting} data-testid="start-interview">
              <Mic /> {t('exam.start')}
            </Button>
          ) : a.exam.status === 'SCHEDULED' ? (
            <p className="font-bold text-primary">{t('exam.notOpen', { date: when(a.exam.opensAt) })}</p>
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
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Bousla mood="sleepy" size={100} />
          <h1 className="font-display text-2xl font-extrabold">{t('exam.missedTitle')}</h1>
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
    <Button asChild variant="ghost" size="sm">
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
        <Card className="space-y-3 p-6" data-testid="exam-result">
          <div className="flex items-center gap-4">
            <Bousla mood="cheering" size={90} />
            <div>
              <p className="text-sm font-bold text-muted-foreground">{t('exam.resultTitle')}</p>
              <p className="font-display text-5xl font-extrabold text-primary">{r.score ?? '–'}<span className="text-2xl text-muted-foreground">/100</span></p>
            </div>
          </div>
          {r.teacherComment && (
            <p className="rounded-[14px] bg-violet-soft p-3 text-sm">
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
                <p className="font-bold text-success">{t('exam.strengths')}</p>
                <ul className="list-disc ps-5 text-sm">{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
            {r.gaps.length > 0 && (
              <div>
                <p className="font-bold text-warning">{t('exam.gaps')}</p>
                <ul className="list-disc ps-5 text-sm">{r.gaps.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-6 text-center" data-testid="exam-done">
          <Bousla mood="cheering" size={110} />
          <h1 className="font-display text-3xl font-extrabold">{t('exam.doneTitle')}</h1>
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
      <h2 className="mb-3 font-display text-lg font-bold">{t('exam.transcript')}</h2>
      <ol className="max-h-80 space-y-2 overflow-y-auto pe-1" data-testid="exam-transcript">
        {turns.map((turn) => (
          <li key={turn.idx} className={cn('flex gap-2', turn.role === 'STUDENT' && 'flex-row-reverse')}>
            <span className="mt-1 text-lg" aria-hidden>
              {turn.role === 'AI' ? turn.emoji || '🧭' : '🗣️'}
            </span>
            <p className={cn('max-w-[85%] rounded-[16px] px-3 py-2 text-sm', turn.role === 'AI' ? 'bg-violet-soft' : 'bg-mint-soft')}>
              <span className="block text-[11px] font-extrabold uppercase opacity-60">{turn.role === 'AI' ? t('exam.bousla') : t('exam.you')}</span>
              {turn.text}
            </p>
          </li>
        ))}
        {live && (
          <li className="flex flex-row-reverse gap-2 opacity-70">
            <span className="mt-1 text-lg">🎙️</span>
            <p className="max-w-[85%] rounded-[16px] border-2 border-dashed border-mint px-3 py-2 text-sm italic">{live}</p>
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
  const lastAi = [...attempt.turns].reverse().find((x) => x.role === 'AI');
  const { enable, enabled } = voice;

  useEffect(() => setAttempt(initial), [initial]);

  // Mic for the teacher's live listening + recording; needs the click that "activated" the room.
  useEffect(() => {
    if (activated && room.status === 'joined' && room.publishes && !enabled) void enable(true);
  }, [activated, room.status, room.publishes, enabled, enable]);

  // Bousla speaks each new question, then we listen for the answer.
  const { speak } = tts;
  const { start: listen, supported: canListen } = stt;
  useEffect(() => {
    if (!activated || !lastAi || lastAi.idx <= spokenIdx || thinking) return;
    setSpokenIdx(lastAi.idx);
    void speak(lastAi.text).then(() => {
      if (canListen && !typing) listen();
    });
  }, [activated, lastAi, spokenIdx, thinking, speak, listen, canListen, typing]);

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

  const mood: BouslaMood = thinking ? 'thinking' : stt.listening ? 'curious' : BOUSLA_FOR[lastAi?.mood ?? 'calm'] ?? 'happy';
  const qn = Math.min(attempt.questionIdx + 1, attempt.questionCount);

  return (
    <div className="space-y-3" data-testid="exam-room">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold">{attempt.exam.title}</h1>
          <p className="text-xs font-bold text-muted-foreground" data-testid="question-progress">{t('exam.question', { n: qn, total: attempt.questionCount })}</p>
        </div>
        {left !== null && (
          <span className={cn('rounded-full px-3 py-1 font-mono text-sm font-extrabold', left < 60 ? 'bg-coral-soft text-coral' : 'bg-sky-soft text-sky')} data-testid="exam-timer">
            ⏱ {t('exam.timeLeft', { time: mmss(left) })}
          </span>
        )}
        {rec.recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-coral-soft px-2.5 py-1 text-xs font-extrabold text-coral">
            <span className="size-2 animate-pulse rounded-full bg-coral" /> {t('study.recording')}
          </span>
        )}
      </div>
      {observed && (
        <p className="flex items-center gap-2 rounded-[12px] bg-violet-soft px-3 py-2 text-sm font-bold text-violet" data-testid="observed">
          <Eye className="size-4" /> {t('exam.observed')}
        </p>
      )}

      <div className="grid items-start gap-3 md:grid-cols-[1fr_1.1fr]">
        <CampusCanvas room={room} map="exam" interactive={false} className="aspect-[18/13] w-full" selfSpeaking={voice.speaking} />
        <Card className="relative flex flex-col items-center gap-3 p-4 text-center">
          <div className="relative">
            <Bousla mood={mood} size={120} />
            <AnimatePresence mode="popLayout">
              {lastAi?.emoji && !thinking && (
                <motion.span
                  key={lastAi.idx}
                  initial={{ scale: 0, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                  className="absolute -end-6 -top-2 text-5xl drop-shadow"
                  data-testid="bousla-emoji"
                >
                  {lastAi.emoji}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="w-full rounded-[18px] bg-violet-soft p-3 text-start" aria-live="polite">
            {thinking ? <Thinking label={t('exam.thinking')} /> : <p className="font-display text-lg font-bold leading-snug" data-testid="bousla-says">{lastAi?.text}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => lastAi && void tts.speak(lastAi.text)} disabled={!lastAi || thinking}>
              <Volume2 /> {t('exam.hearAgain')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => tts.setMuted(!tts.muted)} aria-pressed={tts.muted}>
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
        <Card className="space-y-3 p-4">
          {!stt.supported && <p className="text-sm text-muted-foreground">{t('exam.sttUnsupported')}</p>}
          {stt.supported && !typing ? (
            <div className="space-y-2">
              <p className="min-h-12 rounded-[14px] border-2 border-dashed border-mint p-3 text-sm" data-testid="live-answer">
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
                <Button variant="ghost" onClick={() => { stt.stop(); setTyping(true); }} data-testid="type-instead">
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
                  <Button variant="ghost" onClick={() => setTyping(false)}>
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
        <Button variant="ghost" onClick={() => setConfirm(true)} data-testid="finish-interview">
          {t('exam.finish')}
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>{t('exam.finishTitle')}</DialogTitle>
          <DialogDescription>{t('exam.finishBody')}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t('exam.keepGoing')}
            </Button>
            <Button onClick={finish} data-testid="confirm-finish">
              {t('exam.finish')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
