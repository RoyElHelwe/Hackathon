'use client';

import { examHallMap, hallRooms, type Zone } from '@tajriba/shared';
import { ArrowLeft, Headphones, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * (the student's mic over WebRTC + Bousla's lines in the teacher's browser). Keys 1–9 and [ ] jump between rooms.
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
  const [audioOn, setAudioOn] = useState(false);
  const [bouslaVoice, setBouslaVoice] = useState(true);
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

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/teacher/exams/${id}`}>
          <ArrowLeft className="rtl-flip" /> {t('back')}
        </Link>
      </Button>
      <PageHeader title={`${t('title')} · ${e.title}`} subtitle={t('subtitle', { live: liveCount, total: attempts.length })} />

      {!attempts.length ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {!audioOn ? (
                <Button onClick={() => setAudioOn(true)} data-testid="hall-audio">
                  <Headphones /> {t('audioOn')}
                </Button>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 rounded-full bg-mint-soft px-3 py-1.5 text-sm font-bold text-success" data-testid="hall-audio-on">
                    <Headphones className="size-4" /> {t('audioActive')}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setBouslaVoice((v) => !v)} aria-pressed={bouslaVoice}>
                    {bouslaVoice ? <Volume2 /> : <VolumeX />} {t('bouslaVoice')}
                  </Button>
                </>
              )}
              <span className="ms-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <Keyboard className="size-4" /> {t('keys')}
              </span>
            </div>
            <div className="relative">
              <CampusCanvas room={hall} map={map} onZone={onZone} onApi={setSceneApi} className="h-[62vh] min-h-[360px]" />
              <p
                className={cn(
                  'pointer-events-none absolute inset-x-3 top-3 w-fit rounded-full px-3 py-1.5 text-sm font-bold shadow',
                  focused ? (audioOn ? 'bg-mint text-white' : 'bg-primary text-primary-foreground') : 'bg-card/90',
                )}
                data-testid="hall-focus"
              >
                {focused ? (audioOn ? `🎧 ${t('listeningTo', { name: focused.student.name })}` : t('inRoom', { name: focused.student.name })) : t('corridor')}
              </p>
            </div>
            {hall.status === 'error' && <p className="text-sm font-semibold text-danger">{t('error')}</p>}
            {!audioOn && <p className="text-xs text-muted-foreground">{t('audioHint')}</p>}
          </div>

          <div className="space-y-3">
            <Card className="p-2">
              <ul className="max-h-60 space-y-1 overflow-y-auto" data-testid="hall-rooms">
                {rooms.map((r, i) => {
                  const a = byIndex.get(r.roomIndex);
                  if (!a) return null;
                  const v = views.find((x) => x.roomIndex === r.roomIndex);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => jump(r.roomIndex)}
                        className={cn('flex w-full items-center gap-2 rounded-[12px] px-2 py-1.5 text-start text-sm hover:bg-muted', focus === r.roomIndex && 'bg-violet-soft')}
                        data-testid={`hall-row-${a.student.name.split(' ')[0].toLowerCase()}`}
                      >
                        <kbd className="w-5 shrink-0 rounded bg-muted text-center font-mono text-xs">{i < 9 ? i + 1 : ''}</kbd>
                        <span className={cn('size-2 shrink-0 rounded-full', v?.online ? 'bg-mint' : 'bg-muted-foreground/30')} />
                        <span className="min-w-0 flex-1 truncate font-bold">{a.student.name}</span>
                        {v?.speaking && <span title={t('speaking')}>🎙️</span>}
                        {v?.emoji && <span>{v.emoji}</span>}
                        {a.status === 'IN_PROGRESS' ? <span className="font-mono text-xs text-sky">{v?.caption}</span> : <AttemptStatusBadge status={a.status} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
            {focused ? (
              <FocusPanel key={focused.id} attemptId={focused.id} speech={focusedRoom ? speech[focusedRoom] : undefined} />
            ) : (
              <Card className="p-5 text-sm text-muted-foreground">{t('pickRoom')}</Card>
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
          bouslaVoice={bouslaVoice}
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
        <p className="min-w-0 flex-1 truncate font-extrabold">{a.studentName}</p>
        <AttemptStatusBadge status={a.status} />
      </div>
      {a.turns.length ? <ExamTurns turns={a.turns} live={speech || undefined} /> : <p className="text-sm text-muted-foreground">{t('live.noTurns')}</p>}
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
 * live, so the student's browser calls us; unmounting (walking out) hangs up. Bousla's lines are spoken locally.
 */
function RoomListener(props: {
  room: string;
  attemptId: string;
  locale: string;
  selfId: string;
  peers: PlayerState[];
  listen: (room: string, on: boolean) => void;
  bouslaVoice: boolean;
}) {
  const { room, attemptId, locale, selfId, peers, listen, bouslaVoice } = props;
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
  const voiceOn = useRef(bouslaVoice);
  voiceOn.current = bouslaVoice;
  useEffect(() => {
    if (!bouslaVoice) cancel();
  }, [bouslaVoice, cancel]);
  useSocketEvent<{ attemptId: string; turn: ExamTurn }>('exam:turn', (d) => {
    if (d.attemptId === attemptId && d.turn.role === 'AI' && voiceOn.current) void speak(d.turn.text);
  });
  return null;
}
