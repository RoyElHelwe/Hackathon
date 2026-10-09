'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi, useInvalidate } from '@/lib/hooks';
import type { Classmate, LiveStudySession, MyExam, StudySessionListItem } from './types';

/** An exam room the student can walk into right now. */
export const canEnterExam = (e: MyExam) => e.examStatus === 'OPEN' && (e.status === 'NOT_STARTED' || e.status === 'IN_PROGRESS');

/**
 * Everything the campus needs besides the room itself: classmates, my study sessions and invites, my exam rooms and
 * the sessions running in my classes — plus inviting / answering invites. Shared by the map panels and the lists.
 */
export function useCampusData() {
  const t = useTranslations('campus');
  const router = useRouter();
  const invalidate = useInvalidate();
  const mates = useApi<Classmate[]>('/study-sessions/classmates', { refetchInterval: 15_000 });
  const sessions = useApi<StudySessionListItem[]>('/study-sessions/mine', { refetchInterval: 15_000 });
  const exams = useApi<MyExam[]>('/exams/mine', { refetchInterval: 30_000 });
  const liveRooms = useApi<LiveStudySession[]>('/study-sessions/live', { refetchInterval: 15_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const message = useCallback((e: unknown) => {
    const code = e instanceof ApiError ? String(e.data.code ?? '') : '';
    return t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic');
  }, [t]);

  const invite = useCallback(
    async (partnerId: string) => {
      setBusy(partnerId);
      setError(null);
      try {
        const s = await api<{ id: string }>('/study-sessions', { body: { partnerId } });
        await invalidate('/study-sessions/mine');
        router.push(`/student/study/${s.id}`);
      } catch (e) {
        if (e instanceof ApiError && e.data.code === 'ALREADY_IN_SESSION' && e.data.sessionId) return router.push(`/student/study/${e.data.sessionId}`);
        setError(message(e));
      } finally {
        setBusy(null);
      }
    },
    [invalidate, router, message],
  );

  const respond = useCallback(
    async (id: string, accept: boolean) => {
      setBusy(id);
      setError(null);
      try {
        await api(`/study-sessions/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
        await invalidate('/study-sessions/mine');
        if (accept) router.push(`/student/study/${id}`);
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy(null);
      }
    },
    [invalidate, router, message],
  );

  const list = sessions.data ?? [];
  const examList = exams.data ?? [];
  return {
    mates,
    sessions,
    exams,
    liveRooms,
    busy,
    error,
    invite,
    respond,
    incoming: list.filter((s) => s.status === 'INVITED' && !s.isHost),
    /** my session that is running (or waiting for my partner) */
    mine: list.filter((s) => s.status === 'ACTIVE' || (s.status === 'INVITED' && s.isHost)),
    past: list.filter((s) => s.status === 'ENDED').slice(0, 5),
    enterable: examList.filter(canEnterExam),
    upcoming: examList.filter((e) => e.examStatus === 'SCHEDULED').sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0] ?? null,
  };
}

export type CampusData = ReturnType<typeof useCampusData>;
