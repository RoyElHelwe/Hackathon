'use client';

import type { Zone } from '@tajriba/shared';
import { DoorOpen, GraduationCap, Mic, Users, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Arzino } from '@/components/arzino';
import { CampusCanvas } from '@/components/campus/campus-canvas';
import { EmoteBar } from '@/components/campus/emote-bar';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import type { Classmate, MyExam, StudySessionListItem } from '@/lib/campus/types';
import { useRoom } from '@/lib/campus/use-room';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';

export default function CampusPage() {
  const t = useTranslations('campus');
  const room = useRoom('campus');
  const [zone, setZone] = useState<Zone | null>(null);
  const [full, setFull] = useState(false);
  const onZone = useCallback((z: Zone | null) => setZone(z && (z.kind === 'study_door' || z.kind === 'exam_door') ? z : null), []);
  const emote = room.emote;
  const online = room.players.filter((p) => !p.spectator).length;

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
        <CampusCanvas room={room} map="campus" className="h-[58vh] min-h-[340px] lg:h-[70vh]" onZone={onZone} onFullscreen={setFull}>
          {(fs) => (
            <>
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center gap-2 pe-14">
                <span className="flex items-center gap-2 rounded-full border-2 border-border bg-card/95 px-3 py-1.5 text-sm font-extrabold shadow-[0_3px_0_0_var(--border)]" data-testid="campus-online">
                  <span className={cn('size-2.5 rounded-full', room.status === 'joined' ? 'bg-cedar' : room.status === 'reconnecting' ? 'animate-pulse bg-flame' : 'animate-pulse bg-lock-d')} />
                  {room.status === 'joined' ? t('online', { n: online }) : room.status === 'reconnecting' ? t('reconnecting') : t('connecting')}
                </span>
                {room.status === 'reconnecting' && <WifiOff className="size-5 text-flag" />}
              </div>
              <AnimatePresence>
                {zone && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16 }}
                    className={cn(
                      'absolute inset-x-3 mx-auto flex max-w-xl items-center gap-3 rounded-[20px] border-2 bg-card/95 p-3 shadow-[0_4px_0_0_var(--border)] backdrop-blur',
                      zone.kind === 'exam_door' ? 'border-med' : 'border-cedar',
                      fs.full ? 'bottom-20' : 'bottom-3',
                    )}
                    data-testid="door-panel"
                  >
                    <Arzino mood={zone.kind === 'exam_door' ? 'teaching' : 'reading'} size={64} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-display text-lg font-black leading-tight">
                        <DoorOpen className={cn('size-5 shrink-0', zone.kind === 'exam_door' ? 'text-med' : 'text-cedar')} /> {t(`doors.${zone.kind as 'study_door' | 'exam_door'}.title`)}
                      </p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{t(`doors.${zone.kind as 'study_door' | 'exam_door'}.body`)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={zone.kind === 'exam_door' ? 'kidMint' : 'kid'}
                      onClick={() => {
                        fs.exit();
                        window.setTimeout(() => document.getElementById(zone.kind === 'exam_door' ? 'exams' : 'study')?.scrollIntoView({ behavior: 'smooth' }), fs.full ? 250 : 0);
                      }}
                    >
                      {zone.kind === 'exam_door' ? <GraduationCap /> : <Users />} <span className="hidden sm:inline">{t(`doors.${zone.kind as 'study_door' | 'exam_door'}.title`)}</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
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
        </div>
      </section>

      <ExamRooms />
      <StudyPanel />
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

function ExamRooms() {
  const t = useTranslations('campus');
  const format = useFormatter();
  const exams = useApi<MyExam[]>('/exams/mine', { refetchInterval: 30_000 });
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
            const canEnter = e.examStatus === 'OPEN' && (e.status === 'NOT_STARTED' || e.status === 'IN_PROGRESS');
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

function StudyPanel() {
  const t = useTranslations('campus');
  const router = useRouter();
  const invalidate = useInvalidate();
  const mates = useApi<Classmate[]>('/study-sessions/classmates', { refetchInterval: 15_000 });
  const sessions = useApi<StudySessionListItem[]>('/study-sessions/mine', { refetchInterval: 15_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invite = async (partnerId: string) => {
    setBusy(partnerId);
    setError(null);
    try {
      const s = await api<{ id: string }>('/study-sessions', { body: { partnerId } });
      await invalidate('/study-sessions/mine');
      router.push(`/student/study/${s.id}`);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.data.code ?? '') : '';
      if (code === 'ALREADY_IN_SESSION' && e instanceof ApiError && e.data.sessionId) return router.push(`/student/study/${e.data.sessionId}`);
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await api(`/study-sessions/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
      await invalidate('/study-sessions/mine');
      if (accept) router.push(`/student/study/${id}`);
    } catch (e) {
      const code = e instanceof ApiError ? String(e.data.code ?? '') : '';
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const list = sessions.data ?? [];
  const incoming = list.filter((s) => s.status === 'INVITED' && !s.isHost);
  const live = list.filter((s) => s.status === 'ACTIVE' || (s.status === 'INVITED' && s.isHost));
  const past = list.filter((s) => s.status === 'ENDED').slice(0, 5);

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
              <p className="min-w-0 flex-1 font-display text-base font-black leading-tight">{t('invites.from', { name: s.partner?.name.split(' ')[0] ?? '' })}</p>
              <Button size="sm" variant="kid" loading={busy === s.id} onClick={() => respond(s.id, true)} data-testid="accept-invite">
                {t('invites.accept')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => respond(s.id, false)}>
                {t('invites.decline')}
              </Button>
            </div>
          ))}
        </Card>
      )}

      {live.map((s) => (
        <Card key={s.id} className="flex items-center gap-3 border-med p-3 shadow-[0_4px_0_0_var(--med-d)]">
          <Arzino mood={s.status === 'INVITED' ? 'bored-waiting' : 'streak-buddy'} size={56} />
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-med opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-med" />
          </span>
          <p className="min-w-0 flex-1 font-display text-base font-black leading-tight">
            {s.status === 'INVITED' ? t('invites.waiting', { name: s.partner?.name.split(' ')[0] ?? '' }) : t('study.with', { name: s.partner?.name.split(' ')[0] ?? '' })}
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
              <Card className="chunky-hover flex items-center gap-3 p-3" data-testid={`classmate-${m.name.split(' ')[0].toLowerCase()}`}>
                <div className="relative">
                  <Avatar name={m.name} src={m.avatarUrl ?? undefined} className="size-12" />
                  <span className={cn('absolute -bottom-0.5 -end-0.5 size-4 rounded-full border-[3px] border-card', m.online ? 'bg-cedar' : 'bg-lock-d')} aria-label={m.online ? t('classmates.online') : t('classmates.offline')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-black">{m.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">{m.className}</p>
                </div>
                <Button size="sm" variant="kid" loading={busy === m.userId} disabled={!!busy || live.length > 0} onClick={() => invite(m.userId)} data-testid="invite-classmate">
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
