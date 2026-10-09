'use client';

import { examHallMap, hallRooms, type Zone } from '@tajriba/shared';
import { ArrowLeft, Headphones, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Arzino } from '@/components/arzino';
import { PageHeader } from '@/components/app/adult-shell';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { CampusCanvas } from '@/components/campus/campus-canvas';
import { AttemptStatusBadge } from '@/components/campus/exam-status';
import { ExamTurns } from '@/components/campus/exam-turns';
import type { HallRoomView, SceneApi } from '@/components/campus/scene';
import { mmss } from '@/components/campus/use-countdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTextToSpeech } from '@/lib/campus/speech';
import type { AttemptView, ExamAttemptRow, ExamDetail, ExamTurn, PlayerState } from '@/lib/campus/types';
import { useRoom, useSocketEvent } from '@/lib/campus/use-room';
import { useSpectateMany } from '@/lib/campus/use-spectate-many';
import { useVoice } from '@/lib/campus/use-voice';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate, useMe } from '@/lib/hooks';

const ROOM_ZONE = /^room-(\d+)$/;

type Live = { emoji?: string | null; thinking?: boolean };

/**
 * The Exam Hall: one glass room per student. The teacher walks the corridors; walking into a room = hearing it
 * (the student's mic over WebRTC + Arzino's lines in the teacher's browser). Keys 1–9 and [ ] jump between rooms.
 */
export default function ExamHallPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('campus.teacher.hall');
  const ts = useTranslations('campus.teacher');
  const path = `/exams/${id}`;
  const exam = useApi<ExamDetail>(path, { refetchInterval: 5000 });
  const invalidate = useInvalidate();
  const { data: me } = useMe();

  const attempts = useMemo<ExamAttemptRow[]>(() => exam.data?.attempts ?? [], [exam.data]);
  const indexKey = attempts.map((a) => a.roomIndex).join(',');
  const indexes = useMemo(() => (indexKey ? indexKey.split(',').map(Number) : []), [indexKey]);
  const map = useMemo(() => examHallMap(indexes), [indexes]);
  const rooms = useMemo(() => hallRooms(indexes), [indexes]);
  const byIndex = useMemo(() => new Map(attempts.map((a) => [a.roomIndex, a])), [attempts]);

  const hall = useRoom(exam.data ? `hall:${id}` : null);
  const idsKey = attempts.map((a) => a.id).join(',');
  const watched = useMemo(() => (idsKey ? idsKey.split(',').map((x) => `exam:${x}`) : []), [idsKey]);
  const spect = useSpectateMany(watched);

  const [focus, setFocus] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [arzinoVoice, setArzinoVoice] = useState(true);
  const [sceneApi, setSceneApi] = useState<SceneApi | null>(null);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [speech, setSpeech] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);

  const focused = focus !== null ? byIndex.get(focus) : undefined;

  // Live events from every room: refresh the hall (debounced) and the focused transcript.
  const refreshTimer = useRef<number | undefined>(undefined);
  const focusedId = focused?.id;
  const refresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => void invalidate(path, ...(focusedId ? [`/exam-attempts/${focusedId}`] : [])), 400);
  }, [invalidate, path, focusedId]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);
  const mine = useCallback((attemptId: string) => idsKey.split(',').includes(attemptId), [idsKey]);
  useSocketEvent<{ attemptId: string; turn: ExamTurn }>('exam:turn', (d) => {
    if (!mine(d.attemptId)) return;
    setLive((l) => ({ ...l, [d.attemptId]: { emoji: d.turn.role === 'AI' ? d.turn.emoji : l[d.attemptId]?.emoji, thinking: d.turn.role === 'STUDENT' } }));
    setSpeech((s) => ({ ...s, [`exam:${d.attemptId}`]: '' }));
    refresh();
  });
  useSocketEvent<{ attemptId: string }>('exam:status', (d) => mine(d.attemptId) && refresh());
  useSocketEvent<{ room: string; text: string }>('exam:transcript', (d) => watched.includes(d.room) && setSpeech((s) => ({ ...s, [d.room]: d.text })));

  const onZone = useCallback((z: Zone | null) => {
    const m = z && ROOM_ZONE.exec(z.id);
    setFocus(m ? Number(m[1]) : null);
  }, []);

  const jump = useCallback(
    (roomIndex: number) => {
      const r = rooms.find((x) => x.roomIndex === roomIndex);
      if (r) sceneApi?.teleport(r.entry.x, r.entry.y);
    },
    [rooms, sceneApi],
  );

  // 1–9 jump to a room, [ and ] go to the previous / next room (arrows and WASD still walk).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement | null)?.tagName ?? '')) return;
      if (/^[1-9]$/.test(e.key)) {
        const r = rooms[Number(e.key) - 1];
        if (r) jump(r.roomIndex);
      } else if (e.key === '[' || e.key === ']') {
        if (!rooms.length) return;
        const at = rooms.findIndex((r) => r.roomIndex === focus);
        const next = at < 0 ? 0 : (at + (e.key === ']' ? 1 : rooms.length - 1)) % rooms.length;
        jump(rooms[next].roomIndex);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rooms, focus, jump]);

  const questionCount = exam.data?.questions?.length ?? 0;
  const views = useMemo<HallRoomView[]>(
    () =>
      rooms.flatMap((r) => {
        const a = byIndex.get(r.roomIndex);
        if (!a) return [];
        const players: PlayerState[] = spect.players[`exam:${a.id}`] ?? [];
        const student = players.find((p) => !p.spectator);
        const state: HallRoomView['state'] = a.status === 'IN_PROGRESS' ? 'live' : a.status === 'NOT_STARTED' ? 'waiting' : a.status === 'MISSED' ? 'missed' : 'done';
        const left = state === 'live' && a.endsAt ? Math.max(0, Math.round((new Date(a.endsAt).getTime() - now) / 1000)) : null;
        const l = live[a.id];
        return [
          {
            roomIndex: r.roomIndex,
            zone: r.zone,
            seat: r.seat,
            studentId: a.student.id,
            name: a.student.name.split(' ')[0],
            caption: state === 'live' ? `Q${Math.min(a.questionIdx + 1, questionCount || 1)}/${questionCount || '?'}${left !== null ? ` · ${mmss(left)}` : ''}` : ts(`attempt.${a.status}`),
            emoji: state === 'live' ? (l?.thinking ? '💭' : (l?.emoji ?? a.lastEmoji)) : state === 'done' ? '✅' : null,
            state,
            online: !!student,
            speaking: !!student?.speaking,
            focused: focus === r.roomIndex,
            listening: players.some((p) => p.spectator && p.listening),
          },
        ];
      }),
    [rooms, byIndex, spect.players, now, live, focus, questionCount, ts],
  );
  useEffect(() => {
    sceneApi?.setRooms(views);
  }, [sceneApi, views]);

  if (exam.isLoading) return <PageSkeleton />;
  if (exam.error || !exam.data) return <ErrorState onRetry={() => exam.refetch()} />;
  const e = exam.data;
  const focusedRoom = focused ? `exam:${focused.id}` : null;
  const liveCount = attempts.filter((a) => a.status === 'IN_PROGRESS').length;

  const audioControls = !audioOn ? (
    <Button variant="kidMint" onClick={() => setAudioOn(true)} data-testid="hall-audio">
      <Headphones /> {t('audioOn')}
    </Button>
  ) : (
    <>
      <span className="flex items-center gap-1.5 rounded-full bg-cedar px-3 py-1.5 text-sm font-black text-white shadow-[0_3px_0_0_var(--cedar-d)]" data-testid="hall-audio-on">
        <Headphones className="size-4" /> {t('audioActive')}
      </span>
      <Button variant="kidGhost" size="sm" onClick={() => setArzinoVoice((v) => !v)} aria-pressed={arzinoVoice}>
        {arzinoVoice ? <Volume2 /> : <VolumeX />} {t('arzinoVoice')}
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      <Button asChild variant="kidGhost" size="sm">
        <Link href={`/teacher/exams/${id}`}>
          <ArrowLeft className="rtl-flip" /> {t('back')}
        </Link>
      </Button>
      <div className="flex items-center gap-4">
        <Arzino mood="clipboard" size={88} className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <PageHeader title={`${t('title')} · ${e.title}`} subtitle={t('subtitle', { live: liveCount, total: attempts.length })} />
        </div>
      </div>

      {!attempts.length ? (
        <Card>
          <EmptyState mood="bored-waiting" title={t('empty')} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {!full && audioControls}
              <span className="ms-auto hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground sm:flex">
                <Keyboard className="size-4" /> {t('keys')}
              </span>
            </div>
            <CampusCanvas room={hall} map={map} onZone={onZone} onApi={setSceneApi} onFullscreen={setFull} className="h-[64vh] min-h-[380px] lg:h-[72vh]">
              {(fs) => (
                <>
                  <p
                    className={cn(
                      'pointer-events-none absolute start-3 top-3 me-16 w-fit max-w-[calc(100%-5rem)] truncate rounded-full border-2 px-3 py-1.5 text-sm font-black shadow-[0_3px_0_0_var(--press)]',
                      focused
                        ? audioOn
                          ? 'border-cedar bg-cedar text-white [--press:var(--cedar-d)]'
                          : 'border-med bg-med text-white [--press:var(--med-d)]'
                        : 'border-border bg-card/95 [--press:var(--border)]',
                    )}
                    data-testid="hall-focus"
                  >
                    {focused ? (audioOn ? `🎧 ${t('listeningTo', { name: focused.student.name })}` : t('inRoom', { name: focused.student.name })) : t('corridor')}
                  </p>
                  {fs.full && (
                    <div className="absolute inset-x-3 bottom-3 mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-[20px] border-2 border-border bg-card/90 p-2 shadow-[0_4px_0_0_var(--border)] backdrop-blur">
                      {audioControls}
                      {rooms.map((r, i) => {
                        const a = byIndex.get(r.roomIndex);
                        const v = views.find((x) => x.roomIndex === r.roomIndex);
                        if (!a) return null;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => jump(r.roomIndex)}
                            className={cn(
                              'flex h-10 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-black transition-transform active:translate-y-[2px]',
                              focus === r.roomIndex ? 'border-cedar bg-cedar text-white' : 'border-border bg-card hover:bg-muted',
                            )}
                          >
                            {i < 9 && <kbd className="font-mono text-[11px] opacity-70">{i + 1}</kbd>}
                            <span className={cn('size-2 rounded-full', v?.online ? 'bg-cedar' : 'bg-lock-d', focus === r.roomIndex && 'bg-white')} />
                            {a.student.name.split(' ')[0]}
                            {v?.emoji && <span>{v.emoji}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CampusCanvas>
            {hall.status === 'error' && <p className="text-sm font-bold text-danger">{t('error')}</p>}
            {!audioOn && <p className="text-xs font-semibold text-muted-foreground">{t('audioHint')}</p>}
          </div>

          <div className="space-y-3">
            <Card className="p-2">
              <ul className="max-h-64 space-y-1 overflow-y-auto" data-testid="hall-rooms">
                {rooms.map((r, i) => {
                  const a = byIndex.get(r.roomIndex);
                  if (!a) return null;
                  const v = views.find((x) => x.roomIndex === r.roomIndex);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => jump(r.roomIndex)}
                        className={cn('flex w-full items-center gap-2 rounded-[14px] border-2 border-transparent px-2 py-2 text-start text-sm hover:bg-muted', focus === r.roomIndex && 'border-cedar/40 bg-cedar-soft')}
                        data-testid={`hall-row-${a.student.name.split(' ')[0].toLowerCase()}`}
                      >
                        <kbd className="flex size-6 shrink-0 items-center justify-center rounded-[8px] border-2 border-border bg-card font-mono text-xs font-black">{i < 9 ? i + 1 : ''}</kbd>
                        <span className={cn('size-2.5 shrink-0 rounded-full', v?.online ? 'bg-cedar' : 'bg-lock-d')} />
                        <span className="min-w-0 flex-1 truncate font-black">{a.student.name}</span>
                        {v?.speaking && <span title={t('speaking')}>🎙️</span>}
                        {v?.emoji && <span>{v.emoji}</span>}
                        {a.status === 'IN_PROGRESS' ? <span className="rounded-full bg-med-soft px-2 py-0.5 font-mono text-xs font-black text-med-ink dark:text-white">{v?.caption}</span> : <AttemptStatusBadge status={a.status} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
            {focused ? (
              <FocusPanel key={focused.id} attemptId={focused.id} speech={focusedRoom ? speech[focusedRoom] : undefined} />
            ) : (
              <Card className="flex flex-col items-center gap-2 p-5 text-center">
                <Arzino mood="thinking" size={96} />
                <p className="text-sm font-semibold text-muted-foreground">{t('pickRoom')}</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {audioOn && focused && focusedRoom && spect.joined[focusedRoom] && me && (
        <RoomListener
          key={focusedRoom}
          room={focusedRoom}
          attemptId={focused.id}
          locale={e.locale}
          selfId={me.user.id}
          peers={spect.players[focusedRoom] ?? []}
          listen={spect.listen}
          arzinoVoice={arzinoVoice}
        />
      )}
    </div>
  );
}

/** The room the teacher stands in: transcript with private per-answer scores and the student's live speech. */
function FocusPanel({ attemptId, speech }: { attemptId: string; speech?: string }) {
  const t = useTranslations('campus.teacher');
  const q = useApi<AttemptView>(`/exam-attempts/${attemptId}`);
  const end = useRef<HTMLDivElement>(null);
  const n = q.data?.turns.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [n, speech]);
  if (!q.data) return <Card className="h-40 animate-pulse p-4" />;
  const a = q.data;
  return (
    <Card className="max-h-[52vh] space-y-3 overflow-y-auto p-4" data-testid="hall-panel">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-display text-lg font-black">{a.studentName}</p>
        <AttemptStatusBadge status={a.status} />
      </div>
      {a.turns.length ? (
        <ExamTurns turns={a.turns} live={speech || undefined} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Arzino mood="bored-waiting" size={80} />
          <p className="text-sm font-semibold text-muted-foreground">{t('live.noTurns')}</p>
        </div>
      )}
      {a.status !== 'IN_PROGRESS' && a.status !== 'NOT_STARTED' && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/teacher/exams/attempts/${a.id}`}>{t('detail.review')}</Link>
        </Button>
      )}
      <div ref={end} />
    </Card>
  );
}

/**
 * Mounted only for the room the teacher stands in (with hall audio on). Says "listening" once the signal handler is
 * live, so the student's browser calls us; unmounting (walking out) hangs up. Arzino's lines are spoken locally.
 */
function RoomListener(props: {
  room: string;
  attemptId: string;
  locale: string;
  selfId: string;
  peers: PlayerState[];
  listen: (room: string, on: boolean) => void;
  arzinoVoice: boolean;
}) {
  const { room, attemptId, locale, selfId, peers, listen, arzinoVoice } = props;
  const voice = useVoice({ room, selfId, publishes: false, peers, joined: true });
  const { enable, enabled } = voice;
  useEffect(() => {
    // no mic: the "Turn on hall audio" click already unlocked audio playback
    void enable(false);
  }, [enable]);
  useEffect(() => {
    if (!enabled) return;
    listen(room, true);
    return () => listen(room, false);
  }, [enabled, room, listen]);

  const { speak, cancel } = useTextToSpeech(locale);
  const voiceOn = useRef(arzinoVoice);
  voiceOn.current = arzinoVoice;
  useEffect(() => {
    if (!arzinoVoice) cancel();
  }, [arzinoVoice, cancel]);
  useSocketEvent<{ attemptId: string; turn: ExamTurn }>('exam:turn', (d) => {
    if (d.attemptId === attemptId && d.turn.role === 'AI' && voiceOn.current) void speak(d.turn.text);
  });
  return null;
}
