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

/** Chunky language toggle. `compact` shows only the globe icon on phones. */
export function LanguageSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  const { set, pending } = useSetLocale();
  const next = locale === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      onClick={() => set(next)}
      disabled={pending}
      className={cn(
        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[12px] border-2 border-border bg-card px-3 text-sm font-extrabold shadow-[0_3px_0_var(--border)] transition-[transform,box-shadow] hover:bg-muted active:translate-y-[3px] active:shadow-none disabled:opacity-60',
        compact && 'max-sm:w-10 max-sm:px-0',
        className,
      )}
      aria-label={`Switch language to ${LOCALE_NAMES[next]}`}
      data-testid="language-switch"
    >
      <Languages className="size-4 text-med" />
      <span className={cn(compact && 'max-sm:sr-only')}>{LOCALE_NAMES[next]}</span>
    </button>
  );
}
