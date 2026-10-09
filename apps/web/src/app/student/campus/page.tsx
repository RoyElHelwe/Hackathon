'use client';

import { EMOTE_EMOJI, type Emote, type PlayerState, type Zone } from '@tajriba/shared';
import { DoorOpen, GraduationCap, Hand, Mic, Users, WifiOff, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bousla } from '@/components/bousla';
import { CampusCanvas } from '@/components/campus/campus-canvas';
import { EmoteBar } from '@/components/campus/emote-bar';
import type { SceneApi } from '@/components/campus/scene';
import { EmptyState, ErrorState } from '@/components/app/states';
import { missionHref } from '@/components/student/mission-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { canEnterExam, useCampusData, type CampusData } from '@/lib/campus/use-campus';
import { useRoom } from '@/lib/campus/use-room';
import { cn } from '@/lib/cn';
import { useL } from '@/lib/hooks';
import { useNextMission } from '@/lib/next-mission';

const PANEL_ZONES = new Set<Zone['kind']>(['study_door', 'exam_door', 'npc']);
const first = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export default function CampusPage() {
  const t = useTranslations('campus');
  const room = useRoom('campus');
  const data = useCampusData();
  const [zone, setZone] = useState<Zone | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneApi | null>(null);
  const onZone = useCallback((z: Zone | null) => setZone(z && PANEL_ZONES.has(z.kind) ? z : null), []);

  // Study Hall tables light up while classmates study together; Exam Wing desks glow when my room is open.
  const tableLabels = (data.liveRooms.data ?? []).map((r) => t('liveTable', { a: r.names[0] ?? '', b: r.names[1] ?? '' }));
  const tablesKey = tableLabels.join('|');
  const examOpen = data.enterable.length > 0;
  useEffect(() => {
    scene?.setLiveTables(tablesKey ? tablesKey.split('|') : []);
  }, [scene, tablesKey]);
  useEffect(() => {
    scene?.setExamGlow(examOpen);
  }, [scene, examOpen]);

  // My own emotes: the server only relays to the others, so show them on my avatar right away.
  const selfId = room.self?.userId;
  const { emote: sendEmote, reaction: sendReaction } = room;
  const onEmote = useCallback(
    (e: Emote) => {
      sendEmote(e);
      if (selfId) scene?.emote(selfId, EMOTE_EMOJI[e]);
    },
    [sendEmote, scene, selfId],
  );
  const onReaction = useCallback(
    (emoji: string) => {
      sendReaction(emoji);
      if (selfId) scene?.emote(selfId, emoji);
    },
    [sendReaction, scene, selfId],
  );

  const playerOf = (id: string | null) => (id ? room.players.find((p) => p.userId === id && !p.spectator) ?? null : null);
  const tappedPlayer = playerOf(tapped);
  const nearPlayer = playerOf(near);

  let panel: React.ReactNode = null;
  if (zone) panel = <ZonePanel key={zone.id} zone={zone} data={data} />;
  else if (tappedPlayer) panel = <PlayerCard key={tappedPlayer.userId} player={tappedPlayer} data={data} onWave={() => onEmote('wave')} onClose={() => setTapped(null)} />;
  else if (nearPlayer)
    panel = (
      <motion.div
        key={`near-${nearPlayer.userId}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center"
      >
        <button
          type="button"
          onClick={() => setTapped(nearPlayer.userId)}
          className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-full border-2 border-primary bg-card/95 px-4 py-2 font-display text-base font-bold shadow-xl"
          data-testid="near-chip"
        >
          <Hand className="size-5 text-primary" /> {t('player.near', { name: nearPlayer.name })}
        </button>
      </motion.div>
    );

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Bousla mood="curious" size={64} />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold leading-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </header>

      <section className="space-y-2">
        <div className="relative">
          <CampusCanvas room={room} map="campus" className="h-[52vh] min-h-[320px]" onZone={onZone} onApi={setScene} onPlayerTap={setTapped} onNear={setNear} />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-bold shadow" data-testid="campus-online">
              {room.status === 'joined' ? t('online', { n: room.players.filter((p) => !p.spectator).length }) : room.status === 'reconnecting' ? t('reconnecting') : t('connecting')}
            </span>
            {room.status === 'reconnecting' && <WifiOff className="size-5 text-coral" />}
          </div>
          <AnimatePresence>{panel}</AnimatePresence>
        </div>
        {room.status === 'error' && <p className="text-sm font-semibold text-danger">{t('roomError')}</p>}
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
        <EmoteBar onEmote={onEmote} onReaction={onReaction} compact />
      </section>

      <ExamRooms data={data} />
      <StudyPanel data={data} />
    </div>
  );
}

/** The bottom sheet over the map (doors, Bousla, a classmate's card). */
function MapSheet({ children, className, testId, onClose }: { children: React.ReactNode; className?: string; testId: string; onClose?: () => void }) {
  const t = useTranslations('campus');
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className={cn('absolute inset-x-3 bottom-3 max-h-[70%] overflow-y-auto rounded-[16px] border-2 border-primary bg-card/95 p-3 shadow-xl', className)}
      data-testid={testId}
    >
      {onClose && (
        <Button variant="ghost" size="icon" className="absolute end-1 top-1 size-9" onClick={onClose} aria-label={t('player.close')}>
          <X className="size-4" />
        </Button>
      )}
      {children}
    </motion.div>
  );
}

function ZonePanel({ zone, data }: { zone: Zone; data: CampusData }) {
  if (zone.kind === 'npc') return <BouslaPanel />;
  if (zone.kind === 'exam_door') return <ExamDoor data={data} />;
  return <StudyDoor data={data} />;
}

/** Study Hall door: invite a classmate right here (online ones first), or go back to my running session. */
function StudyDoor({ data }: { data: CampusData }) {
  const t = useTranslations('campus');
  const mine = data.mine[0];
  const mates = (data.mates.data ?? []).slice(0, 4);
  return (
    <MapSheet testId="door-panel">
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <DoorOpen className="size-5 text-mint" /> {t('doors.study_door.title')}
      </p>
      {mine ? (
        <Button asChild size="sm" variant="kidMint" className="mt-2" data-testid="door-open-room">
          <Link href={`/student/study/${mine.id}`}>{t('doors.openRoom')}</Link>
        </Button>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('doors.pick')}</p>
          {data.error && <p className="mt-1 text-sm font-semibold text-coral">{data.error}</p>}
          {!mates.length ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('doors.noMates')}</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {mates.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 rounded-[12px] bg-muted/60 p-2">
                  <span className={cn('size-2.5 shrink-0 rounded-full', m.online ? 'bg-mint' : 'bg-muted-foreground/40')} aria-label={m.online ? t('classmates.online') : t('classmates.offline')} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{m.name}</span>
                  <Button size="sm" variant="kid" loading={data.busy === m.userId} disabled={!!data.busy} onClick={() => data.invite(m.userId)} data-testid={`door-invite-${first(m.name).toLowerCase()}`}>
                    {t('classmates.invite')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </MapSheet>
  );
}

/** Exam Wing door: straight into my open exam room, or when the next one opens. */
function ExamDoor({ data }: { data: CampusData }) {
  const t = useTranslations('campus');
  const format = useFormatter();
  const when = (d: string) => format.dateTime(new Date(d), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <MapSheet testId="door-panel">
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <GraduationCap className="size-5 text-sky" /> {t('doors.exam_door.title')}
      </p>
      {data.enterable.length ? (
        <ul className="mt-2 space-y-2">
          {data.enterable.map((e) => (
            <li key={e.attemptId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{e.title}</span>
              <Button asChild size="sm" variant="kid" data-testid="door-enter-exam">
                <Link href={`/student/exams/${e.attemptId}`}>{t('exams.enter')}</Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground" data-testid="door-no-exam">
          {t('doors.noExam')} {data.upcoming && t('doors.nextExam', { title: data.upcoming.title, date: when(data.upcoming.opensAt) })}
        </p>
      )}
    </MapSheet>
  );
}

/** Standing in front of Bousla: it points you to your next mission. */
function BouslaPanel() {
  const t = useTranslations('campus');
  const l = useL();
  const { mission, isLoading } = useNextMission();
  return (
    <MapSheet testId="bousla-panel" className="flex items-center gap-3">
      <Bousla mood={mission ? 'happy' : 'cheering'} size={64} className="shrink-0" />
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-10" />
        ) : mission ? (
          <>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{t('npc.next')}</p>
            <p className="truncate font-display text-lg font-bold leading-tight">{l(mission.title)}</p>
            <Button asChild size="sm" variant="kidSunny" className="mt-2" data-testid="bousla-go">
              <Link href={missionHref(mission)}>{t('npc.go')}</Link>
            </Button>
          </>
        ) : (
          <p className="font-display text-base font-bold">{t('npc.done')}</p>
        )}
      </div>
    </MapSheet>
  );
}

/** A classmate's card: level, say hi, invite to study. */
function PlayerCard({ player, data, onWave, onClose }: { player: PlayerState; data: CampusData; onWave: () => void; onClose: () => void }) {
  const t = useTranslations('campus');
  const mate = data.mates.data?.find((m) => m.userId === player.userId);
  const teacher = player.role === 'TEACHER';
  return (
    <MapSheet testId="player-card" onClose={onClose}>
      <div className="flex items-center gap-3 pe-8">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-lg font-extrabold text-white shadow" style={{ background: player.color }}>
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold leading-tight">{player.name}</p>
          <p className="text-sm font-semibold text-muted-foreground">{teacher ? `🎓 ${t('player.teacher')}` : player.level ? t('player.level', { n: player.level }) : mate?.className}</p>
        </div>
      </div>
      {data.error && <p className="mt-1 text-sm font-semibold text-coral">{data.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="kidGhost" onClick={onWave} data-testid="player-wave">
          👋 {t('player.wave')}
        </Button>
        {mate && !data.mine.length && (
          <Button size="sm" variant="kid" loading={data.busy === mate.userId} disabled={!!data.busy} onClick={() => data.invite(mate.userId)} data-testid="player-invite">
            <Users /> {t('player.invite')}
          </Button>
        )}
      </div>
    </MapSheet>
  );
}

function ExamRooms({ data }: { data: CampusData }) {
  const t = useTranslations('campus');
  const format = useFormatter();
  const { exams } = data;
  const when = (d: string) => format.dateTime(new Date(d), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <section id="exams" className="space-y-3 scroll-mt-20">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Mic className="size-6 text-sky" /> {t('exams.title')}
      </h2>
      {exams.isLoading ? (
        <Skeleton className="h-24" />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : !exams.data?.length ? (
        <p className="text-sm text-muted-foreground">{t('exams.empty')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {exams.data.map((e) => {
            const canEnter = canEnterExam(e);
            const finished = e.status === 'GRADING' || e.status === 'GRADED' || e.status === 'RELEASED';
            return (
              <li key={e.attemptId}>
                <Card className={cn('flex h-full flex-col gap-2 p-4', canEnter && 'border-sky shadow-[0_0_0_3px_rgba(76,184,255,0.25)]')} data-testid="exam-room-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold leading-tight">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.className} · {t('exams.room', { n: e.roomIndex })} · {t('exams.minutes', { n: e.durationMin })}
                      </p>
                    </div>
                    <Badge variant={e.status === 'RELEASED' ? 'mint' : e.status === 'MISSED' ? 'coral' : canEnter ? 'default' : 'muted'}>{t(`exams.status.${e.status}`)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {e.examStatus === 'SCHEDULED' ? t('exams.opens', { date: when(e.opensAt) }) : e.examStatus === 'OPEN' ? t('exams.openUntil', { date: when(e.closesAt) }) : null}
                  </p>
                  {e.status === 'RELEASED' && e.score != null && <p className="font-display text-xl font-extrabold text-success">{t('exams.score', { score: e.score })}</p>}
                  {(e.status === 'GRADING' || e.status === 'GRADED') && <p className="text-sm font-semibold text-muted-foreground">{t('exams.waiting')}</p>}
                  <div className="mt-auto">
                    {canEnter ? (
                      <Button asChild variant="kid" className="w-full" data-testid="enter-exam-room">
                        <Link href={`/student/exams/${e.attemptId}`}>{t('exams.enter')}</Link>
                      </Button>
                    ) : finished ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/student/exams/${e.attemptId}`}>{t('exams.view')}</Link>
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StudyPanel({ data }: { data: CampusData }) {
  const t = useTranslations('campus');
  const { mates, busy, error, incoming, mine, past } = data;

  return (
    <section id="study" className="space-y-3 scroll-mt-20">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Users className="size-6 text-mint" /> {t('classmates.title')}
      </h2>
      {error && <p className="rounded-[12px] bg-coral-soft p-3 text-sm font-semibold text-coral">{error}</p>}

      {incoming.length > 0 && (
        <Card className="space-y-2 border-violet p-4">
          <h3 className="font-display text-lg font-bold">{t('invites.title')}</h3>
          {incoming.map((s) => (
            <div key={s.id} className="flex items-center gap-3" data-testid="incoming-invite">
              <Avatar name={s.partner?.name ?? '?'} src={s.partner?.avatarUrl ?? undefined} className="size-10" />
              <p className="min-w-0 flex-1 text-sm font-bold">{t('invites.from', { name: first(s.partner?.name ?? '') })}</p>
              <Button size="sm" variant="kid" loading={busy === s.id} onClick={() => data.respond(s.id, true)} data-testid="accept-invite">
                {t('invites.accept')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => data.respond(s.id, false)}>
                {t('invites.decline')}
              </Button>
            </div>
          ))}
        </Card>
      )}

      {mine.map((s) => (
        <Card key={s.id} className="flex items-center gap-3 border-mint p-4">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-mint" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold">
            {s.status === 'INVITED' ? t('invites.waiting', { name: first(s.partner?.name ?? '') }) : t('study.with', { name: first(s.partner?.name ?? '') })}
          </p>
          <Button asChild size="sm" variant="kidMint">
            <Link href={`/student/study/${s.id}`}>{t('invites.open')}</Link>
          </Button>
        </Card>
      ))}

      {mates.isLoading ? (
        <Skeleton className="h-32" />
      ) : mates.error ? (
        <ErrorState onRetry={() => mates.refetch()} />
      ) : !mates.data?.length ? (
        <EmptyState title={t('classmates.empty')} mood="sleepy" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {mates.data.map((m) => (
            <li key={m.userId}>
              <Card className="flex items-center gap-3 p-3" data-testid={`classmate-${first(m.name).toLowerCase()}`}>
                <div className="relative">
                  <Avatar name={m.name} src={m.avatarUrl ?? undefined} className="size-11" />
                  <span className={cn('absolute -bottom-0.5 -end-0.5 size-3.5 rounded-full border-2 border-card', m.online ? 'bg-mint' : 'bg-muted-foreground/40')} aria-label={m.online ? t('classmates.online') : t('classmates.offline')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.className}</p>
                </div>
                <Button size="sm" variant="kid" loading={busy === m.userId} disabled={!!busy || mine.length > 0} onClick={() => data.invite(m.userId)} data-testid="invite-classmate">
                  {t('classmates.invite')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg font-bold">{t('sessions.title')}</h3>
          <ul className="space-y-2">
            {past.map((s) => (
              <li key={s.id}>
                <Link href={`/student/study/${s.id}`} className="flex items-center gap-3 rounded-[16px] border border-border bg-card p-3 hover:bg-muted">
                  <span aria-hidden>🎧</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{t('sessions.with', { name: s.partner?.name ?? '' })}</span>
                  <Badge variant="muted">{t(`sessions.status.${s.status}`)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
