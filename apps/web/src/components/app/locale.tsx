'use client';

import { Languages } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

export const LOCALE_NAMES: Record<string, string> = { en: 'English', ar: 'العربية' };

export function useSetLocale() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (locale: string) => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
    api('/me', { method: 'PATCH', body: { locale } }).catch(() => undefined);
    start(() => router.refresh());
  };
  return { set, pending };
}

export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const { set, pending } = useSetLocale();
  const next = locale === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      onClick={() => set(next)}
      disabled={pending}
      className={cn('inline-flex h-10 items-center gap-2 rounded-full border-2 border-border bg-card px-3 text-sm font-bold hover:bg-muted', className)}
      aria-label={`Switch language to ${LOCALE_NAMES[next]}`}
      data-testid="language-switch"
    >
      <Languages className="size-4" />
      {LOCALE_NAMES[next]}
    </button>
  );
}
