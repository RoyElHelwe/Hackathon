'use client';

import { distance, voiceGain } from '@tajriba/shared';
import { ArrowLeft, Mic, MicOff, PhoneOff, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Arzino, ArzinoSays } from '@/components/arzino';
import { CampusCanvas } from '@/components/campus/campus-canvas';
import { EmoteBar } from '@/components/campus/emote-bar';
import type { SceneApi } from '@/components/campus/scene';
import { SessionReplay } from '@/components/campus/session-replay';
import { mmss } from '@/components/campus/use-countdown';
import { ErrorState, PageSkeleton, Thinking } from '@/components/app/states';
import { fireConfetti } from '@/components/kid/celebrations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { DiscussionCard, StudySessionDetail } from '@/lib/campus/types';
import { useRecorder } from '@/lib/campus/use-recorder';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useVoice } from '@/lib/campus/use-voice';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useMe } from '@/lib/hooks';

export default function StudyRoomPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('campus');
  const { data: me } = useMe();
  const path = `/study-sessions/${id}`;
  const session = useApi<StudySessionDetail>(path, { refetchInterval: (q) => (q.state.data?.status === 'INVITED' ? 4000 : false) });
  const invalidate = useInvalidate();
  const [joined, setJoined] = useState<null | { mic: boolean }>(null);
  const [ended, setEnded] = useState<{ xp: number } | null>(null);
  const [accepting, setAccepting] = useState(false);
  // voices are only recorded when the school turned study recording on; the notice must say what really happens
  const { data: cfg } = useApi<{ recordStudySessions?: boolean }>('/auth/config');
  const recordsVoice = cfg?.recordStudySessions === true;
  const notice = t(recordsVoice ? 'study.recordingNotice' : 'study.activityNotice');

  useSocketEvent<{ sessionId: string; xpBy?: Record<string, number> }>('study:ended', (d) => {
    if (d.sessionId !== id) return;
    const xp = (me && d.xpBy?.[me.user.id]) || 0; // 0 when the session was too short or the daily cap was reached
    setEnded({ xp });
    if (xp) fireConfetti(true);
    void invalidate(path, '/study-sessions/mine', '/gamification/me');
  });
  useSocketEvent<{ sessionId: string }>('study:status', (d) => d.sessionId === id && void invalidate(path));
  useSocketEvent<{ sessionId: string }>('study:accepted', (d) => d.sessionId === id && void invalidate(path));

  if (session.isLoading || !me) return <PageSkeleton />;
  if (session.error || !session.data) return <ErrorState onRetry={() => session.refetch()} />;
  const s = session.data;
  const myId = me.user.id;
  const partner = s.participants.find((p) => p.userId !== myId);
  const names = Object.fromEntries(s.participants.map((p) => [p.userId, p.name.split(' ')[0]]));
  const partnerName = partner?.name.split(' ')[0] ?? '';

  if (ended || s.status === 'ENDED' || s.status === 'DECLINED' || s.status === 'EXPIRED') {
    return (
      <div className="space-y-5">
        <Card className="mx-auto flex max-w-[680px] flex-col items-center gap-3 p-6 text-center sm:p-8" data-testid="study-ended">
          <Arzino mood={s.status === 'ENDED' || ended ? (ended && ended.xp > 0 ? 'party' : 'celebrate') : 'bored-waiting'} size={180} pop />
          <h1 className="font-display text-3xl font-black md:text-[34px]">{t('study.endedTitle')}</h1>
          <p className="text-muted-foreground">{s.status === 'ENDED' || ended ? t('study.endedBody') : t(`sessions.status.${s.status}`)}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {ended && ended.xp > 0 && (
              <span className="rounded-[16px] border-2 border-med bg-med-soft px-4 py-2 font-display text-2xl font-black text-med-ink shadow-[0_4px_0_0_var(--med-d)] dark:text-white">{t('study.xp', { xp: ended.xp })}</span>
            )}
            {s.startedAt && s.endedAt && (
              <span className="rounded-[16px] border-2 border-border bg-muted px-4 py-2 font-display text-lg font-black shadow-[0_4px_0_0_var(--border)]">
                ⏱ {t('study.duration', { time: mmss(Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)) })}
              </span>
            )}
          </div>
          <Button asChild variant="kid" size="lg" className="mt-2">
            <Link href="/student/campus">{t('study.back')}</Link>
          </Button>
        </Card>
        {(s.status === 'ENDED' || ended) && (
          <>
            <h2 className="font-display text-2xl font-black">{t('study.replayTitle')}</h2>
            <SessionReplay kind="STUDY" refId={s.id} events={s.events} names={names} />
          </>
        )}
      </div>
    );
  }

  if (s.status === 'INVITED' && s.hostId !== myId) {
    const accept = async () => {
      setAccepting(true);
      try {
        await api(`${path}/accept`, { method: 'POST' });
        await invalidate(path, '/study-sessions/mine');
      } finally {
        setAccepting(false);
      }
    };
    return (
      <Card className="mx-auto flex max-w-[680px] flex-col items-center gap-4 p-6 text-center sm:p-8">
        <Arzino mood="welcome" size={160} pop />
        <h1 className="font-display text-3xl font-black">{t('study.invitedYou', { name: partnerName })}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{notice}</p>
        <Button variant="kid" size="lg" onClick={accept} loading={accepting} data-testid="accept-study">
          {t('study.accept')}
        </Button>
      </Card>
    );
  }

  if (!joined) {
    return (
      <Card className="mx-auto flex max-w-[680px] flex-col items-center gap-5 p-6 text-center sm:p-8" data-testid="study-prejoin">
        <ArzinoSays mood={s.status === 'INVITED' ? 'bored-waiting' : 'streak-buddy'} size={140}>
          {s.status === 'INVITED' ? t('invites.waiting', { name: partnerName }) : t('study.with', { name: partnerName })}
        </ArzinoSays>
        {s.topic && <p className="rounded-full bg-cedar-soft px-4 py-1.5 font-bold text-cedar-ink dark:text-white">{t('study.topic', { topic: s.topic })}</p>}
        <p className={cn('flex max-w-md items-start gap-2 rounded-[14px] border-2 p-3 text-start text-sm font-semibold', recordsVoice ? 'border-flag/30 bg-flag-soft text-flag-d dark:text-danger' : 'border-border bg-muted text-muted-foreground')}>
          {recordsVoice && <span className="mt-1 inline-flex size-2.5 shrink-0 animate-pulse rounded-full bg-flag" />} {notice}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="kid" size="lg" onClick={() => setJoined({ mic: true })} data-testid="join-voice">
            <Mic /> {t('study.joinVoice')}
          </Button>
          <Button variant="kidGhost" size="lg" onClick={() => setJoined({ mic: false })} data-testid="join-no-mic">
            {t('study.joinNoMic')}
          </Button>
        </div>
      </Card>
    );
  }

  return <StudyRoom session={s} myId={myId} withMic={joined.mic} names={names} />;
}

function StudyRoom({ session, myId, withMic, names }: { session: StudySessionDetail; myId: string; withMic: boolean; names: Record<string, string> }) {
  const t = useTranslations('campus');
  const room = useRoom(session.room);
  const voice = useVoice({ room: session.room, selfId: myId, publishes: room.publishes, peers: room.players, joined: room.status === 'joined' });
  // Study sessions are recorded only when the server enables it (RECORD_STUDY_SESSIONS).
  const { data: cfg } = useApi<{ recordStudySessions?: boolean }>('/auth/config');
  const rec = useRecorder({ kind: 'STUDY', refId: session.id, stream: voice.stream, active: session.status === 'ACTIVE' && cfg?.recordStudySessions === true });
  const scene = useRef<SceneApi | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [full, setFull] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState<number | null>(null);
  const lastVoice = useRef(Date.now());
  const partner = session.participants.find((p) => p.userId !== myId);
  const partnerHere = room.players.some((p) => p.userId === partner?.userId && !p.spectator);
  const { enable, enabled } = voice;

  // Turn voice on as soon as we are in the room (the click that got us here allows mic + autoplay).
  useEffect(() => {
    if (room.status === 'joined' && room.publishes && !enabled) void enable(withMic);
  }, [room.status, room.publishes, enabled, enable, withMic]);

  // Tell others when I speak (ring around my avatar).
  const { speaking: emitSpeaking } = room;
  useEffect(() => {
    emitSpeaking(voice.speaking);
    if (voice.speaking) lastVoice.current = Date.now();
  }, [voice.speaking, emitSpeaking]);
  const { subscribe } = room;
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === 'speaking' && e.speaking) lastVoice.current = Date.now();
      }),
    [subscribe],
  );

  // Proximity voice: closer = louder.
  const { setVolume } = voice;
  useEffect(() => {
    const iv = window.setInterval(() => {
      const a = scene.current;
      const me = a?.selfPos();
      if (!a || !me) return;
      for (const [id, pos] of a.positions()) setVolume(id, voiceGain(distance(me, pos)));
    }, 300);
    return () => window.clearInterval(iv);
  }, [setVolume]);

  // Elapsed time + Arzino's tips when it gets quiet.
  useEffect(() => {
    const start = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const iv = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
      if (Date.now() - lastVoice.current > 30_000) {
        setTip((n) => ((n ?? -1) + 1) % 4);
        lastVoice.current = Date.now();
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [session.startedAt]);
  useEffect(() => {
    if (tip === null) return;
    const to = window.setTimeout(() => setTip(null), 9000);
    return () => window.clearTimeout(to);
  }, [tip]);

  const end = async () => {
    setEnding(true);
    rec.stop();
    try {
      await api(`/study-sessions/${session.id}/end`, { method: 'POST' });
    } finally {
      setEnding(false);
      setConfirm(false);
    }
  };

  const onEmote = room.emote;
  const localEmote = useMemo(
    () => (e: Parameters<typeof onEmote>[0]) => {
      onEmote(e);
      scene.current?.emote(myId, { wave: '👋', laugh: '😂', dance: '💃', mindblown: '🤯', clap: '👏', think: '🤔' }[e]);
    },
    [onEmote, myId],
  );
  const localReaction = (emoji: string) => {
    room.reaction(emoji);
    scene.current?.emote(myId, emoji);
  };

  const partnerFirst = partner?.name.split(' ')[0] ?? '';
  const micButton = (testId?: string) => (
    <Button variant={voice.micOn ? 'kidMint' : 'kidGhost'} onClick={voice.toggleMic} disabled={!voice.stream} aria-pressed={voice.micOn} data-testid={testId}>
      {voice.micOn ? <Mic /> : <MicOff />} <span className={cn(!testId && 'hidden sm:inline')}>{t('study.mic')}</span>
    </Button>
  );

  return (
    <div className="space-y-4" data-testid="study-room">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="kidGhost" size="icon" aria-label={t('study.back')}>
          <Link href="/student/campus">
            <ArrowLeft className="rtl-flip" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-black">{t('study.with', { name: partnerFirst })}</h1>
          <p className={cn('flex items-center gap-1.5 text-sm font-bold', partnerHere ? 'text-success' : 'text-muted-foreground')} data-testid="partner-status">
            <span className={cn('size-2.5 rounded-full', partnerHere ? 'bg-cedar' : 'animate-pulse bg-lock-d')} />
            {partnerHere ? t('study.here', { name: partnerFirst }) : t('study.away', { name: partnerFirst })}
          </p>
        </div>
        <span className="rounded-full border-2 border-border bg-card px-3 py-1 font-mono text-sm font-black shadow-[0_3px_0_0_var(--border)]">⏱ {mmss(elapsed)}</span>
        {rec.recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-flag-soft px-3 py-1 text-xs font-black uppercase tracking-wider text-flag-d dark:text-danger" data-testid="recording-chip">
            <span className="size-2 animate-pulse rounded-full bg-flag" /> {t('study.recording')}
          </span>
        )}
      </div>

      <CampusCanvas room={room} map="study" className="aspect-[10/7] max-h-[72vh] w-full" selfSpeaking={voice.speaking} onApi={(a) => (scene.current = a)} onFullscreen={setFull}>
        {(fs) => (
          <>
            {room.status !== 'joined' && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/75">
                {room.status === 'error' ? <p className="font-bold text-danger">{t('roomError')}</p> : <Thinking label={room.status === 'reconnecting' ? t('reconnecting') : t('connecting')} />}
              </div>
            )}
            {fs.full && (
              <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-center gap-2 pe-14">
                <span className="rounded-full border-2 border-border bg-card/95 px-3 py-1.5 font-display text-sm font-black shadow-[0_3px_0_0_var(--border)]">
                  {t('study.with', { name: partnerFirst })} · ⏱ {mmss(elapsed)}
                </span>
                {rec.recording && (
                  <span className="flex items-center gap-1.5 rounded-full bg-flag px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">
                    <span className="size-2 animate-pulse rounded-full bg-white" /> {t('study.recording')}
                  </span>
                )}
              </div>
            )}
            <AnimatePresence>
              {tip !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn('absolute inset-x-3 mx-auto flex max-w-lg items-center gap-2 rounded-[20px] border-2 border-border bg-card/95 p-2 pe-4 text-sm font-bold shadow-[0_4px_0_0_var(--border)]', fs.full ? 'bottom-24' : 'bottom-3')}
                >
                  <Arzino mood="teaching" size={56} />
                  <span className="min-w-0 flex-1">{t(`study.tip${tip + 1}` as 'study.tip1')}</span>
                </motion.div>
              )}
            </AnimatePresence>
            {fs.full && (
              <div className="absolute inset-x-3 bottom-3 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-[20px] border-2 border-border bg-card/90 p-2 shadow-[0_4px_0_0_var(--border)] backdrop-blur">
                {micButton()}
                <EmoteBar onEmote={localEmote} onReaction={localReaction} compact />
                <Button
                  variant="kidCoral"
                  size="icon"
                  aria-label={t('study.end')}
                  onClick={() => {
                    fs.exit();
                    setConfirm(true);
                  }}
                >
                  <PhoneOff />
                </Button>
              </div>
            )}
          </>
        )}
      </CampusCanvas>

      {voice.error === 'mic_denied' && <p className="rounded-[14px] border-2 border-flag/30 bg-flag-soft p-3 text-sm font-bold text-flag-d dark:text-danger">{t('study.micDenied')}</p>}

      {!full && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {micButton('mic-toggle')}
            <Button variant="kidCoral" onClick={() => setConfirm(true)} data-testid="end-session">
              <PhoneOff /> {t('study.end')}
            </Button>
          </div>
          <EmoteBar onEmote={localEmote} onReaction={localReaction} />
        </>
      )}

      <DiscussionCards sessionId={session.id} />

      <details className="chunky rounded-[20px] p-4">
        <summary className="cursor-pointer font-display text-lg font-black">{t('study.timeline')}</summary>
        <div className="mt-3">
          <SessionReplay kind="STUDY" refId={session.id} events={session.events} names={names} showTimeline />
        </div>
      </details>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <div className="flex justify-center">
            <Arzino mood="sad" size={110} />
          </div>
          <DialogTitle>{t('study.endTitle')}</DialogTitle>
          <DialogDescription>{t('study.endBody')}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="kidGhost" onClick={() => setConfirm(false)}>
              {t('study.cancel')}
            </Button>
            <Button variant="kidCoral" onClick={end} loading={ending} data-testid="confirm-end">
              {t('study.end')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiscussionCards({ sessionId }: { sessionId: string }) {
  const t = useTranslations('campus');
  const cards = useApi<{ cards: DiscussionCard[] }>(`/study-sessions/${sessionId}/cards`, { staleTime: Infinity });
  const [i, setI] = useState(0);
  const list = cards.data?.cards ?? [];
  const card = list.length ? list[i % list.length] : null;
  const tone = {
    QUESTION: 'bg-med-soft border-med shadow-[0_4px_0_0_var(--med-d)]',
    CHALLENGE: 'bg-flame-soft border-flame shadow-[0_4px_0_0_var(--flame-d)]',
    FUN: 'bg-flag-soft border-flag shadow-[0_4px_0_0_var(--flag-d)]',
  } as const;

  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-black">{t('study.cards.title')}</h2>
      {cards.isLoading ? (
        <Thinking label={t('study.cards.loading')} />
      ) : !card ? null : (
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={cn('flex items-center gap-3 rounded-[20px] border-2 p-4 sm:p-5', tone[card.kind])}
            data-testid="discussion-card"
          >
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{t(`study.cards.${card.kind}`)}</p>
              <p className="font-display text-xl font-black leading-snug">{card.prompt}</p>
            </div>
            <Button variant="kidGhost" size="icon" onClick={() => setI((n) => n + 1)} aria-label={t('study.cards.next')} data-testid="next-card">
              <Shuffle />
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
