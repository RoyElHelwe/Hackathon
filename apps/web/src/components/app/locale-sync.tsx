'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/lib/hooks';

/** On first visit (no NEXT_LOCALE cookie yet), adopt the language saved on the user's profile. */
export function LocaleSync() {
  const { data: me } = useMe();
  const locale = useLocale();
  const router = useRouter();
  useEffect(() => {
    if (!me?.user.locale || me.user.locale === locale) return;
    if (document.cookie.split('; ').some((c) => c.startsWith('NEXT_LOCALE='))) return;
    if (!['en', 'ar'].includes(me.user.locale)) return;
    document.cookie = `NEXT_LOCALE=${me.user.locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [me, locale, router]);
  return null;
}
