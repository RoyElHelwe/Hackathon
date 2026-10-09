'use client';

import type { Zone } from '@tajriba/shared';
import { DoorOpen, GraduationCap, Mic, Users, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Bousla } from '@/components/bousla';
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
  const onZone = useCallback((z: Zone | null) => setZone(z && (z.kind === 'study_door' || z.kind === 'exam_door') ? z : null), []);
  const emote = room.emote;

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
          <CampusCanvas room={room} map="campus" className="h-[52vh] min-h-[320px]" onZone={onZone} />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-bold shadow" data-testid="campus-online">
              {room.status === 'joined' ? t('online', { n: room.players.filter((p) => !p.spectator).length }) : room.status === 'reconnecting' ? t('reconnecting') : t('connecting')}
            </span>
            {room.status === 'reconnecting' && <WifiOff className="size-5 text-coral" />}
          </div>
          <AnimatePresence>
            {zone && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="absolute inset-x-3 bottom-3 rounded-[16px] border-2 border-primary bg-card/95 p-3 shadow-xl"
                data-testid="door-panel"
              >
                <p className="flex items-center gap-2 font-display text-lg font-bold">
                  <DoorOpen className="size-5 text-primary" /> {t(`doors.${zone.kind as 'study_door' | 'exam_door'}.title`)}
                </p>
                <p className="text-sm text-muted-foreground">{t(`doors.${zone.kind as 'study_door' | 'exam_door'}.body`)}</p>
                <Button size="sm" className="mt-2" variant="kid" onClick={() => document.getElementById(zone.kind === 'exam_door' ? 'exams' : 'study')?.scrollIntoView({ behavior: 'smooth' })}>
                  {zone.kind === 'exam_door' ? <GraduationCap /> : <Users />} {t(`doors.${zone.kind as 'study_door' | 'exam_door'}.title`)}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {room.status === 'error' && <p className="text-sm font-semibold text-danger">{t('roomError')}</p>}
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
        <EmoteBar onEmote={emote} onReaction={room.reaction} compact />
      </section>

      <ExamRooms />
      <StudyPanel />
    </div>
  );
}

function ExamRooms() {
  const t = useTranslations('campus');
  const format = useFormatter();
  const exams = useApi<MyExam[]>('/exams/mine', { refetchInterval: 30_000 });
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
            const canEnter = e.examStatus === 'OPEN' && (e.status === 'NOT_STARTED' || e.status === 'IN_PROGRESS');
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
              <p className="min-w-0 flex-1 text-sm font-bold">{t('invites.from', { name: s.partner?.name.split(' ')[0] ?? '' })}</p>
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
        <Card key={s.id} className="flex items-center gap-3 border-mint p-4">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-mint" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold">
            {s.status === 'INVITED' ? t('invites.waiting', { name: s.partner?.name.split(' ')[0] ?? '' }) : t('study.with', { name: s.partner?.name.split(' ')[0] ?? '' })}
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
              <Card className="flex items-center gap-3 p-3" data-testid={`classmate-${m.name.split(' ')[0].toLowerCase()}`}>
                <div className="relative">
                  <Avatar name={m.name} src={m.avatarUrl ?? undefined} className="size-11" />
                  <span className={cn('absolute -bottom-0.5 -end-0.5 size-3.5 rounded-full border-2 border-card', m.online ? 'bg-mint' : 'bg-muted-foreground/40')} aria-label={m.online ? t('classmates.online') : t('classmates.offline')} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.className}</p>
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
