import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'NEXT_LOCALE';

const NAMESPACES = ['common', 'landing', 'auth', 'student', 'mission', 'teacher', 'parent', 'director'] as const;

async function loadMessages(locale: AppLocale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`).catch(() => ({ default: {} }));
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}

type Tree = { [k: string]: string | Tree };
function deepMerge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = typeof v === 'object' && typeof base[k] === 'object' ? deepMerge(base[k] as Tree, v) : v;
  }
  return out;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  let locale = store.get(LOCALE_COOKIE)?.value as AppLocale | undefined;
  if (!locale || !LOCALES.includes(locale)) {
    const accept = (await headers()).get('accept-language') ?? '';
    locale = accept.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
  const [messages, fallback] = await Promise.all([loadMessages(locale), locale === 'en' ? null : loadMessages('en')]);
  // Fall back to English per namespace for any missing key.
  const merged = fallback
    ? Object.fromEntries(Object.keys(fallback).map((ns) => [ns, deepMerge(fallback[ns] as Tree, messages[ns] as Tree)]))
    : messages;
  return { locale, messages: merged, timeZone: 'Asia/Beirut', now: new Date() };
});
