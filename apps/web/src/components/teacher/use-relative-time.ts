'use client';

import { useFormatter, useNow } from 'next-intl';
import { useCallback } from 'react';

/** "5 minutes ago" with an explicit `now` (avoids next-intl's environment fallback warning). */
export function useRelativeTime() {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return useCallback((d: string | Date) => format.relativeTime(new Date(d), now), [format, now]);
}
