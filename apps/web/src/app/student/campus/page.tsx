'use client';

import type { PlayerState, Zone } from '@tajriba/shared';
import { DoorOpen, GraduationCap, Hand, Mic, Users, WifiOff, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Arzino } from '@/components/arzino';
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
  const [full, setFull] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);
  const [near, setNear] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneApi | null>(null);
  const onZone = useCallback((z: Zone | null) => setZone(z && PANEL_ZONES.has(z.kind) ? z : null), []);
  // the room hook echoes my own emotes and reactions locally (the server only relays to the others)
  const emote = room.emote;
  const online = room.players.filter((p) => !p.spectator).length;

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

  const playerOf = (id: string | null) => (id ? room.players.find((p) => p.userId === id && !p.spectator) ?? null : null);
  const tappedPlayer = playerOf(tapped);
  const nearPlayer = playerOf(near);

  const panel = (fs: { full: boolean; exit: () => void }) => {
    const bottom = fs.full ? 'bottom-20' : 'bottom-3';
    if (zone) return <ZonePanel key={zone.id} zone={zone} data={data} className={bottom} onLeave={fs.exit} />;
    if (tappedPlayer) return <PlayerCard key={tappedPlayer.userId} player={tappedPlayer} data={data} className={bottom} onWave={() => emote('wave')} onClose={() => setTapped(null)} />;
    if (nearPlayer)
      return (
        <motion.div
          key={`near-${nearPlayer.userId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className={cn('pointer-events-none absolute inset-x-3 flex justify-center', bottom)}
        >
          <button
            type="button"
            onClick={() => setTapped(nearPlayer.userId)}
            className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-full border-2 border-cedar bg-card/95 px-4 py-2 font-display text-base font-black shadow-[0_4px_0_0_var(--cedar-d)]"
            data-testid="near-chip"
          >
            <Hand className="size-5 text-cedar" /> {t('player.near', { name: nearPlayer.name })}
          </button>
        </motion.div>
      );
    return null;
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Arzino mood="lebanese-pride" size={96} pop priority />
        <div className="min-w-0">
          <p className="eyebrow">{t('tab')}</p>
          <h1 className="font-display text-3xl font-black leading-tight md:text-[34px]">{t('title')}</h1>
          <p className="text-[15px] text-muted-foreground">{t('subtitle')}</p>
        </div>
      </header>

      <section className="space-y-3">
        <CampusCanvas
          room={room}
          map="campus"
          className="h-[58vh] min-h-[340px] lg:h-[70vh]"
          onZone={onZone}
          onApi={setScene}
          onPlayerTap={setTapped}
          onNear={setNear}
          onFullscreen={setFull}
        >
          {(fs) => (
            <>
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center gap-2 pe-14">
                <span className="flex items-center gap-2 rounded-full border-2 border-border bg-card/95 px-3 py-1.5 text-sm font-extrabold shadow-[0_3px_0_0_var(--border)]" data-testid="campus-online">
                  <span className={cn('size-2.5 rounded-full', room.status === 'joined' ? 'bg-cedar' : room.status === 'reconnecting' ? 'animate-pulse bg-flame' : 'animate-pulse bg-lock-d')} />
                  {room.status === 'joined' ? t('online', { n: online }) : room.status === 'reconnecting' ? t('reconnecting') : t('connecting')}
                </span>
                {room.status === 'reconnecting' && <WifiOff className="size-5 text-flag" />}
              </div>
              <AnimatePresence>{panel(fs)}</AnimatePresence>
              {fs.full && (
                <div className="absolute inset-x-3 bottom-3 flex justify-center">
                  <EmoteBar onEmote={emote} onReaction={room.reaction} compact className="justify-center rounded-[20px] border-2 border-border bg-card/90 p-1.5 shadow-[0_4px_0_0_var(--border)] backdrop-blur" />
                </div>
              )}
            </>
          )}
        </CampusCanvas>
        {room.status === 'error' && <p className="text-sm font-bold text-danger">{t('roomError')}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!full && <EmoteBar onEmote={emote} onReaction={room.reaction} compact />}
          <p className="text-xs font-semibold text-muted-foreground">{t('hint')}</p>
          <Button asChild size="sm" variant="kidGhost" data-testid="campus-vr">
            <Link href="/vr?scene=campus">🥽 {t('enterVr')}</Link>
          </Button>
        </div>
      </section>

      <ExamRooms data={data} />
      <StudyPanel data={data} />
    </div>
  );
}

function SectionTitle({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone: 'med' | 'cedar' }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-2xl font-black">
      <span className={cn('flex size-10 items-center justify-center rounded-[14px] text-white shadow-[0_4px_0_0_var(--press)] [&_svg]:size-5', tone === 'med' ? 'bg-med [--press:var(--med-d)]' : 'bg-cedar [--press:var(--cedar-d)]')}>{icon}</span>
      {children}
    </h2>
  );
}

/** The sheet over the map (doors, Arzino, a classmate's card). */
function MapSheet({ children, className, testId, tone = 'cedar', onClose }: { children: React.ReactNode; className?: string; testId: string; tone?: 'cedar' | 'med'; onClose?: () => void }) {
  const t = useTranslations('campus');
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16 }}
      className={cn(
        'absolute inset-x-3 mx-auto max-h-[70%] max-w-xl overflow-y-auto rounded-[20px] border-2 bg-card/95 p-3 shadow-[0_4px_0_0_var(--border)] backdrop-blur',
        tone === 'med' ? 'border-med' : 'border-cedar',
        className,
      )}
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

type SheetProps = { data: CampusData; className?: string; onLeave: () => void };

function ZonePanel({ zone, ...rest }: SheetProps & { zone: Zone }) {
  if (zone.kind === 'npc') return <ArzinoPanel {...rest} />;
  if (zone.kind === 'exam_door') return <ExamDoor {...rest} />;
  return <StudyDoor {...rest} />;
}

/** Study Hall door: invite a classmate right here (online ones first), or go back to my running session. */
function StudyDoor({ data, className, onLeave }: SheetProps) {
  const t = useTranslations('campus');
  const mine = data.mine[0];
  const mates = (data.mates.data ?? []).slice(0, 4);
  return (
    <MapSheet testId="door-panel" className={className}>
      <div className="flex items-center gap-3">
        <Arzino mood="reading" size={56} className="shrink-0" />
        <p className="flex items-center gap-2 font-display text-lg font-black leading-tight">
          <DoorOpen className="size-5 shrink-0 text-cedar" /> {t('doors.study_door.title')}
        </p>
      </div>
      {mine ? (
        <Button asChild size="sm" variant="kid" className="mt-2" data-testid="door-open-room" onClick={onLeave}>
          <Link href={`/student/study/${mine.id}`}>{t('doors.openRoom')}</Link>
        </Button>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('doors.pick')}</p>
          {data.error && <p className="mt-1 text-sm font-bold text-flag">{data.error}</p>}
          {!mates.length ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('doors.noMates')}</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {mates.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 rounded-[14px] bg-muted/60 p-2">
                  <span className={cn('size-2.5 shrink-0 rounded-full', m.online ? 'bg-cedar' : 'bg-lock-d')} aria-label={m.online ? t('classmates.online') : t('classmates.offline')} />
                  <span className="min-w-0 flex-1 truncate text-sm font-black">{m.name}</span>
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
function ExamDoor({ data, className, onLeave }: SheetProps) {
  const t = useTranslations('campus');
  const format = useFormatter();
  const when = (d: string) => format.dateTime(new Date(d), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <MapSheet testId="door-panel" tone="med" className={className}>
      <div className="flex items-center gap-3">
        <Arzino mood="teaching" size={56} className="shrink-0" />
        <p className="flex items-center gap-2 font-display text-lg font-black leading-tight">
          <GraduationCap className="size-5 shrink-0 text-med" /> {t('doors.exam_door.title')}
        </p>
      </div>
      {data.enterable.length ? (
        <ul className="mt-2 space-y-2">
          {data.enterable.map((e) => (
            <li key={e.attemptId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-black">{e.title}</span>
              <Button asChild size="sm" variant="kidMint" data-testid="door-enter-exam" onClick={onLeave}>
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

/** Standing in front of Arzino: it points you to your next mission. */
function ArzinoPanel({ className, onLeave }: SheetProps) {
  const t = useTranslations('campus');
  const l = useL();
  const { mission, isLoading } = useNextMission();
  return (
    <MapSheet testId="arzino-panel" className={cn('flex items-center gap-3', className)}>
      <Arzino mood={mission ? 'welcome' : 'celebrate'} size={64} className="shrink-0" />
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-10" />
        ) : mission ? (
          <>
            <p className="eyebrow">{t('npc.next')}</p>
            <p className="truncate font-display text-lg font-black leading-tight">{l(mission.title)}</p>
            <Button asChild size="sm" variant="kidSunny" className="mt-2" data-testid="arzino-go" onClick={onLeave}>
              <Link href={missionHref(mission)}>{t('npc.go')}</Link>
            </Button>
          </>
        ) : (
          <p className="font-display text-base font-black">{t('npc.done')}</p>
        )}
      </div>
    </MapSheet>
  );
}

/** A classmate's card: level, say hi, invite to study. */
function PlayerCard({ player, data, className, onWave, onClose }: { player: PlayerState; data: CampusData; className?: string; onWave: () => void; onClose: () => void }) {
  const t = useTranslations('campus');
  const mate = data.mates.data?.find((m) => m.userId === player.userId);
  const teacher = player.role === 'TEACHER';
  return (
    <MapSheet testId="player-card" className={className} onClose={onClose}>
      <div className="flex items-center gap-3 pe-8">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-lg font-black text-white shadow" style={{ background: player.color }}>
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-black leading-tight">{player.name}</p>
          <p className="text-sm font-bold text-muted-foreground">{teacher ? `🎓 ${t('player.teacher')}` : player.level ? t('player.level', { n: player.level }) : mate?.className}</p>
        </div>
      </div>
      {data.error && <p className="mt-1 text-sm font-bold text-flag">{data.error}</p>}
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
      <SectionTitle icon={<Mic />} tone="med">
        {t('exams.title')}
      </SectionTitle>
      {exams.isLoading ? (
        <Skeleton className="h-28 rounded-[20px]" />
      ) : exams.error ? (
        <ErrorState onRetry={() => exams.refetch()} />
      ) : !exams.data?.length ? (
        <Card className="flex items-center gap-4 p-4">
          <Arzino mood="bored-waiting" size={72} />
          <p className="font-display text-lg font-black text-muted-foreground">{t('exams.empty')}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {exams.data.map((e) => {
            const canEnter = canEnterExam(e);
            const finished = e.status === 'GRADING' || e.status === 'GRADED' || e.status === 'RELEASED';
            return (
              <li key={e.attemptId}>
                <Card className={cn('flex h-full flex-col gap-3 p-4', canEnter && 'border-med shadow-[0_4px_0_0_var(--med-d)]')} data-testid="exam-room-card">
                  <div className="flex items-start gap-3">
                    <span className={cn('flex size-12 shrink-0 flex-col items-center justify-center rounded-[14px] font-display leading-none', canEnter ? 'bg-med text-white' : 'bg-muted text-muted-foreground')}>
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-80">#</span>
                      <span className="text-lg font-black">{e.roomIndex}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-black leading-tight">{e.title}</p>
                      <p className="text-xs font-bold text-muted-foreground">
                        {e.className} · {t('exams.room', { n: e.roomIndex })} · {t('exams.minutes', { n: e.durationMin })}
                      </p>
                    </div>
                    <Badge variant={e.status === 'RELEASED' ? 'mint' : e.status === 'MISSED' ? 'coral' : canEnter ? 'sky' : 'muted'}>{t(`exams.status.${e.status}`)}</Badge>
                  </div>
                  {(e.examStatus === 'SCHEDULED' || e.examStatus === 'OPEN') && (
                    <p className="text-sm font-semibold text-muted-foreground">{e.examStatus === 'SCHEDULED' ? t('exams.opens', { date: when(e.opensAt) }) : t('exams.openUntil', { date: when(e.closesAt) })}</p>
                  )}
                  {e.status === 'RELEASED' && e.score != null && <p className="font-display text-2xl font-black text-cedar-ink dark:text-success">{t('exams.score', { score: e.score })}</p>}
                  {(e.status === 'GRADING' || e.status === 'GRADED') && (
                    <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                      <Arzino mood="clipboard" size={36} animate={false} /> {t('exams.waiting')}
                    </p>
                  )}
                  <div className="mt-auto">
                    {canEnter ? (
                      <Button asChild variant="kidMint" className="w-full" data-testid="enter-exam-room">
                        <Link href={`/student/exams/${e.attemptId}`}>
                          <DoorOpen /> {t('exams.enter')}
                        </Link>
                      </Button>
                    ) : finished ? (
                      <Button asChild variant="kidGhost" size="sm">
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
      <SectionTitle icon={<Users />} tone="cedar">
        {t('classmates.title')}
      </SectionTitle>
      {error && <p className="rounded-[14px] border-2 border-flag/30 bg-flag-soft p-3 text-sm font-bold text-flag-d dark:text-danger">{error}</p>}

      {incoming.length > 0 && (
        <Card className="space-y-3 border-cedar p-4 shadow-[0_4px_0_0_var(--cedar-d)]">
          <h3 className="eyebrow">{t('invites.title')}</h3>
          {incoming.map((s) => (
            <div key={s.id} className="flex items-center gap-3" data-testid="incoming-invite">
              <Avatar name={s.partner?.name ?? '?'} src={s.partner?.avatarUrl ?? undefined} className="size-10" />
              <p className="min-w-0 flex-1 font-display text-base font-black leading-tight">{t('invites.from', { name: first(s.partner?.name ?? '') })}</p>
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
        <Card key={s.id} className="flex items-center gap-3 border-med p-3 shadow-[0_4px_0_0_var(--med-d)]">
          <Arzino mood={s.status === 'INVITED' ? 'bored-waiting' : 'streak-buddy'} size={56} />
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-med opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-med" />
          </span>
          <p className="min-w-0 flex-1 font-display text-base font-black leading-tight">
            {s.status === 'INVITED' ? t('invites.waiting', { name: first(s.partner?.name ?? '') }) : t('study.with', { name: first(s.partner?.name ?? '') })}
          </p>
          <Button asChild size="sm" variant="kidMint">
            <Link href={`/student/study/${s.id}`}>{t('invites.open')}</Link>
          </Button>
        </Card>
      ))}

      {mates.isLoading ? (
        <Skeleton className="h-32 rounded-[20px]" />
      ) : mates.error ? (
        <ErrorState onRetry={() => mates.refetch()} />
      ) : !mates.data?.length ? (
        <EmptyState title={t('classmates.empty')} mood="sleepy" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {mates.data.map((m) => (
            <li key={m.userId}>
              <Card className="chunky-hover flex items-center gap-3 p-3" data-testid={`classmate-${first(m.name).toLowerCase()}`}>
                <div className="relative">
                  <Avatar name={m.name} src={m.avatarUrl ?? undefined} className="size-12" />
                  <span className={cn('absolute -bottom-0.5 -end-0.5 size-4 rounded-full border-[3px] border-card', m.online ? 'bg-cedar' : 'bg-lock-d')} aria-label={m.online ? t('classmates.online') : t('classmates.offline')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-black">{m.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">{m.className}</p>
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
          <h3 className="eyebrow">{t('sessions.title')}</h3>
          <ul className="space-y-2">
            {past.map((s) => (
              <li key={s.id}>
                <Link href={`/student/study/${s.id}`} className="chunky chunky-hover flex items-center gap-3 rounded-[16px] p-3">
                  <span className="flex size-9 items-center justify-center rounded-[12px] bg-med-soft text-lg" aria-hidden>
                    🎧
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold">{t('sessions.with', { name: s.partner?.name ?? '' })}</span>
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
