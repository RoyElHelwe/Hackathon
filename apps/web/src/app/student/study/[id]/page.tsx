'use client';

import { distance, STUDY_MIN_XP_MS, voiceGain } from '@tajriba/shared';
import { ArrowLeft, Mic, MicOff, PhoneOff, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bousla, BouslaSays } from '@/components/bousla';
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

  useSocketEvent<{ sessionId: string; reason?: string; xpBy?: Record<string, number> }>('study:ended', (d) => {
    if (d.sessionId !== id) return;
    if (d.reason === 'DECLINED') {
      // the invite was declined or cancelled: the page shows that status, not "session over"
      void invalidate(path, '/study-sessions/mine');
      return;
    }
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
        <Card className="flex flex-col items-center gap-3 p-6 text-center" data-testid="study-ended">
          <Bousla mood="cheering" size={110} />
          <h1 className="font-display text-3xl font-extrabold">{t('study.endedTitle')}</h1>
          <p className="text-muted-foreground">{s.status === 'ENDED' || ended ? t('study.endedBody') : t(`sessions.status.${s.status}`)}</p>
          {ended && ended.xp > 0 && <p className="font-display text-2xl font-extrabold text-violet">{t('study.xp', { xp: ended.xp })}</p>}
          {s.startedAt && s.endedAt && <p className="text-sm text-muted-foreground">{t('study.duration', { time: mmss(Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)) })}</p>}
          <Button asChild variant="kid">
            <Link href="/student/campus">{t('study.back')}</Link>
          </Button>
        </Card>
        {(s.status === 'ENDED' || ended) && (
          <>
            <h2 className="font-display text-2xl font-bold">{t('study.replayTitle')}</h2>
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
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <Bousla mood="happy" size={100} />
        <h1 className="font-display text-2xl font-extrabold">{t('study.invitedYou', { name: partnerName })}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{notice}</p>
        <Button variant="kid" size="lg" onClick={accept} loading={accepting} data-testid="accept-study">
          {t('study.accept')}
        </Button>
      </Card>
    );
  }

  if (!joined) {
    return (
      <Card className="flex flex-col items-center gap-4 p-6 text-center" data-testid="study-prejoin">
        <BouslaSays mood="curious">{s.status === 'INVITED' ? t('invites.waiting', { name: partnerName }) : t('study.with', { name: partnerName })}</BouslaSays>
        {s.topic && <p className="font-semibold">{t('study.topic', { topic: s.topic })}</p>}
        <p className={cn('flex max-w-md items-start gap-2 rounded-[14px] p-3 text-start text-sm font-semibold', recordsVoice ? 'bg-coral-soft text-coral' : 'bg-muted text-muted-foreground')}>
          {recordsVoice && <span className="mt-1 inline-flex size-2.5 shrink-0 animate-pulse rounded-full bg-coral" />} {notice}
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
  const [ending, setEnding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // together time: stored total + the running segment (both partners in the room)
  const [together, setTogether] = useState({ ms: session.togetherMs, since: session.togetherSince });
  useSocketEvent<{ sessionId: string; togetherMs: number; since: string | null }>('study:together', (d) => {
    if (d.sessionId === session.id) setTogether({ ms: d.togetherMs, since: d.since });
  });
  const togetherMs = together.ms + (together.since ? Math.max(0, now - new Date(together.since).getTime()) : 0);
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

  // Clock for the together timer + Bousla's tips when it gets quiet.
  useEffect(() => {
    const iv = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() - lastVoice.current > 30_000) {
        setTip((n) => ((n ?? -1) + 1) % 4);
        lastVoice.current = Date.now();
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, []);
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

  return (
    <div className="space-y-3" data-testid="study-room">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t('study.back')}>
          <Link href="/student/campus">
            <ArrowLeft className="rtl-flip" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-extrabold">{t('study.with', { name: partner?.name.split(' ')[0] ?? '' })}</h1>
          <p className={cn('text-xs font-bold', partnerHere ? 'text-success' : 'text-muted-foreground')} data-testid="partner-status">
            {partnerHere ? t('study.here', { name: partner?.name.split(' ')[0] ?? '' }) : t('study.away', { name: partner?.name.split(' ')[0] ?? '' })}
          </p>
        </div>
        <TogetherChip ms={togetherMs} running={!!together.since} />
        {rec.recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-coral-soft px-2.5 py-1 text-xs font-extrabold text-coral" data-testid="recording-chip">
            <span className="size-2 animate-pulse rounded-full bg-coral" /> {t('study.recording')}
          </span>
        )}
      </div>

      <div className="relative">
        <CampusCanvas room={room} map="study" className="aspect-[10/7] w-full" selfSpeaking={voice.speaking} onApi={(a) => (scene.current = a)} />
        {room.status !== 'joined' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-background/70">
            {room.status === 'error' ? <p className="font-bold text-danger">{t('roomError')}</p> : <Thinking label={room.status === 'reconnecting' ? t('reconnecting') : t('connecting')} />}
          </div>
        )}
        <AnimatePresence>
          {tip !== null && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-3 bottom-3 rounded-[16px] bg-card/95 p-3 text-sm font-bold shadow-lg">
              {t(`study.tip${tip + 1}` as 'study.tip1')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {voice.error === 'mic_denied' && <p className="rounded-[12px] bg-coral-soft p-3 text-sm font-semibold text-coral">{t('study.micDenied')}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={voice.micOn ? 'kidMint' : 'kidGhost'} onClick={voice.toggleMic} disabled={!voice.stream} aria-pressed={voice.micOn} data-testid="mic-toggle">
          {voice.micOn ? <Mic /> : <MicOff />} {t('study.mic')}
        </Button>
        <Button variant="kidCoral" onClick={() => setConfirm(true)} data-testid="end-session">
          <PhoneOff /> {t('study.end')}
        </Button>
      </div>
      <EmoteBar onEmote={localEmote} onReaction={localReaction} />

      <DiscussionCards sessionId={session.id} />

      <details className="rounded-[16px] border border-border bg-card p-3">
        <summary className="cursor-pointer font-bold">{t('study.timeline')}</summary>
        <div className="mt-3">
          <SessionReplay kind="STUDY" refId={session.id} events={session.events} names={names} showTimeline />
        </div>
      </details>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>{t('study.endTitle')}</DialogTitle>
          <DialogDescription>{t('study.endBody')}</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t('study.cancel')}
            </Button>
            <Button variant="destructive" onClick={end} loading={ending} data-testid="confirm-end">
              {t('study.end')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "Together 3:12" with a ring filling up to the 5 minutes that earn study XP. */
function TogetherChip({ ms, running }: { ms: number; running: boolean }) {
  const t = useTranslations('campus');
  const done = ms >= STUDY_MIN_XP_MS;
  const p = Math.min(1, ms / STUDY_MIN_XP_MS);
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn('flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold', done ? 'bg-mint-soft text-success' : 'bg-violet-soft text-violet')}
      title={done ? t('study.togetherDone') : t('study.togetherGoal')}
      data-testid="together-chip"
    >
      <svg viewBox="0 0 24 24" className={cn('size-5 -rotate-90', running && !done && 'animate-pulse')} aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={3} />
        <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      <span className="font-mono">{t('study.together', { time: mmss(Math.floor(ms / 1000)) })}</span>
      {done && <span>{t('study.togetherDone')}</span>}
    </span>
  );
}

function DiscussionCards({ sessionId }: { sessionId: string }) {
  const t = useTranslations('campus');
  const cards = useApi<{ cards: DiscussionCard[] }>(`/study-sessions/${sessionId}/cards`, { staleTime: Infinity });
  const [i, setI] = useState(0);
  const list = cards.data?.cards ?? [];
  const card = list.length ? list[i % list.length] : null;
  const tone = { QUESTION: 'bg-sky-soft border-sky', CHALLENGE: 'bg-sunny-soft border-sunny', FUN: 'bg-coral-soft border-coral' } as const;

  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-bold">{t('study.cards.title')}</h2>
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
            className={cn('flex items-center gap-3 rounded-[20px] border-2 p-4', tone[card.kind])}
            data-testid="discussion-card"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wide opacity-70">{t(`study.cards.${card.kind}`)}</p>
              <p className="font-display text-lg font-bold leading-snug">{card.prompt}</p>
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
