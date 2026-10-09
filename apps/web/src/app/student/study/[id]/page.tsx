'use client';

import { distance, STUDY_MIN_XP_MS, voiceGain } from '@tajriba/shared';
import { ArrowLeft, ListChecks, Mic, MicOff, PhoneOff, Shuffle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
          <Button asChild variant="kidSunny" size="lg" data-testid="join-vr">
            <Link href={`/vr?scene=study:${s.id}`}>🥽 {t('study.joinVr')}</Link>
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
  const [sceneApi, setSceneApi] = useState<SceneApi | null>(null);
  // what the Ideas board shows: the mission we're working on ("Ask a friend") or the discussion cards
  const [boardMode, setBoardMode] = useState<'mission' | 'cards'>(session.mission ? 'mission' : 'cards');
  const cards = useApi<{ cards: DiscussionCard[] }>(`/study-sessions/${session.id}/cards`, { staleTime: Infinity });
  const cardList = cards.data?.cards ?? [];
  const card = cardList.length ? cardList[room.boardIndex % cardList.length] : null;
  const [confirm, setConfirm] = useState(false);
  const [full, setFull] = useState(false);
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

  // Clock for the together timer + Arzino's tips when it gets quiet.
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

  // Chalk on the Ideas board, the same for both partners.
  const boardText =
    boardMode === 'mission' && session.mission
      ? [session.mission.title, ...session.mission.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`)].join('\n')
      : card
        ? `${t(`study.cards.${card.kind}`)}: ${card.prompt}`
        : null;
  useEffect(() => {
    sceneApi?.setBoard(boardText);
  }, [sceneApi, boardText]);

  // the room echoes my own emotes and reactions to the scene
  const localEmote = room.emote;
  const localReaction = room.reaction;

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
          {session.mission && (
            <p className="truncate text-sm font-bold text-cedar-ink dark:text-cedar" data-testid="helping-with">
              🆘 {t('study.mission.working', { title: session.mission.title })}
            </p>
          )}
          <p className={cn('flex items-center gap-1.5 text-sm font-bold', partnerHere ? 'text-success' : 'text-muted-foreground')} data-testid="partner-status">
            <span className={cn('size-2.5 rounded-full', partnerHere ? 'bg-cedar' : 'animate-pulse bg-lock-d')} />
            {partnerHere ? t('study.here', { name: partnerFirst }) : t('study.away', { name: partnerFirst })}
          </p>
        </div>
        <TogetherChip ms={togetherMs} running={!!together.since} />
        {rec.recording && (
          <span className="flex items-center gap-1.5 rounded-full bg-flag-soft px-3 py-1 text-xs font-black uppercase tracking-wider text-flag-d dark:text-danger" data-testid="recording-chip">
            <span className="size-2 animate-pulse rounded-full bg-flag" /> {t('study.recording')}
          </span>
        )}
      </div>

      <CampusCanvas room={room} map="study" className="aspect-[10/7] max-h-[72vh] w-full" selfSpeaking={voice.speaking} onApi={(a) => {
          scene.current = a;
          setSceneApi(a);
        }}
        onFullscreen={setFull}
      >
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
                  {t('study.with', { name: partnerFirst })} · {t('study.together', { time: mmss(Math.floor(togetherMs / 1000)) })}
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

      {session.mission && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('study.board.label')}>
          <span className="text-sm font-bold text-muted-foreground">{t('study.board.label')}</span>
          {(['mission', 'cards'] as const).map((m) => (
            <Button key={m} size="sm" variant={boardMode === m ? 'kid' : 'kidGhost'} aria-pressed={boardMode === m} onClick={() => setBoardMode(m)} data-testid={`board-${m}`}>
              {t(`study.board.${m}`)}
            </Button>
          ))}
        </div>
      )}
      {boardMode === 'mission' && session.mission ? (
        <section className="space-y-2 rounded-[20px] border-2 border-cedar bg-cedar-soft p-4 shadow-[0_4px_0_0_var(--cedar-d)]" data-testid="mission-on-board">
          <p className="flex items-center gap-2 font-display text-lg font-black">
            <ListChecks className="size-5 text-cedar" /> {session.mission.title}
          </p>
          <ol className="list-decimal space-y-1 ps-6 text-sm font-semibold">
            {session.mission.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {session.hostId === myId && (
            <Link href={`/student/missions/${session.mission.id}`} className="inline-block text-sm font-bold text-med-ink underline dark:text-med">
              {t('study.mission.back')}
            </Link>
          )}
        </section>
      ) : (
        <DiscussionCards loading={cards.isLoading} card={card} index={room.boardIndex} onNext={() => room.board(room.boardIndex + 1)} />
      )}

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

/** "Together 3:12" with a ring filling up to the 5 minutes that earn study XP. */
function TogetherChip({ ms, running }: { ms: number; running: boolean }) {
  const t = useTranslations('campus');
  const done = ms >= STUDY_MIN_XP_MS;
  const p = Math.min(1, ms / STUDY_MIN_XP_MS);
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn(
        'flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-black shadow-[0_3px_0_0_var(--border)]',
        done ? 'border-cedar bg-cedar-soft text-cedar-ink dark:text-cedar' : 'border-border bg-card text-foreground',
      )}
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

/** The discussion card on the Ideas board; shuffling flips it for both partners. */
function DiscussionCards({ loading, card, index, onNext }: { loading: boolean; card: DiscussionCard | null; index: number; onNext: () => void }) {
  const t = useTranslations('campus');
  const i = index;
  const tone = {
    QUESTION: 'bg-med-soft border-med shadow-[0_4px_0_0_var(--med-d)]',
    CHALLENGE: 'bg-flame-soft border-flame shadow-[0_4px_0_0_var(--flame-d)]',
    FUN: 'bg-flag-soft border-flag shadow-[0_4px_0_0_var(--flag-d)]',
  } as const;

  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-black">{t('study.cards.title')}</h2>
      {loading ? (
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
            <Button variant="kidGhost" size="icon" onClick={onNext} aria-label={t('study.cards.next')} data-testid="next-card">
              <Shuffle />
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
