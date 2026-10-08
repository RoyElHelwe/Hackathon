'use client';

import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { localized, pickText, type I18nText } from '@tajriba/shared';
import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { api } from './api';
import type { Localized, Me } from './types';

export function useApi<T>(path: string | null, opts: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> = {}) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => api<T>(path!),
    enabled: !!path && (opts.enabled ?? true),
    ...opts,
  });
}

export function useMe() {
  return useApi<Me>('/me', { retry: false, staleTime: 30_000 });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback((...paths: string[]) => Promise.all(paths.map((p) => qc.invalidateQueries({ queryKey: [p] }))), [qc]);
}

/** Localizes JSON content from the API ({ en, ar }). */
export function useL() {
  const locale = useLocale();
  return useCallback(
    <T,>(v: Localized<T> | null | undefined): T => {
      if (typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && 'en' in v && typeof (v as I18nText).en === 'string')) {
        return pickText(v as I18nText, locale) as T;
      }
      return localized(v as T, locale) as T;
    },
    [locale],
  );
}
