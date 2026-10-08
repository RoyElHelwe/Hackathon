'use client';

import { useApi, useMe } from '@/lib/hooks';
import type { DirectorDashboard } from './types';

export function useSchoolId() {
  const { data: me } = useMe();
  return me?.active?.schoolId ?? null;
}

export const dashboardPath = (schoolId: string) => `/dashboards/director/${schoolId}`;

/** The director dashboard for the active school (shared cache across director pages). */
export function useDirectorDashboard() {
  const schoolId = useSchoolId();
  const q = useApi<DirectorDashboard>(schoolId ? dashboardPath(schoolId) : null, { staleTime: 30_000 });
  return { ...q, schoolId, isLoading: q.isLoading || !schoolId };
}
