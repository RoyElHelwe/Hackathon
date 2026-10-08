'use client';

import { ArrowLeft } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALE_NAMES, useSetLocale } from '@/components/app/locale';
import { useSettings } from '@/components/app/theme';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

export default function SettingsPage() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { set } = useSetLocale();
  const { theme, setTheme, sounds, setSounds } = useSettings();
  const seg = (active: boolean) => cn('h-12 flex-1 rounded-[14px] font-bold', active ? 'bg-primary text-white' : 'bg-muted');
  return (
    <main className="mx-auto max-w-lg space-y-4 p-4">
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-bold text-muted-foreground">
        <ArrowLeft className="rtl-flip size-5" /> {t('back')}
      </button>
      <h1 className="font-display text-3xl font-extrabold">{t('settingsTitle')}</h1>
      <Card className="space-y-3 p-5">
        <p className="font-bold">{t('language')}</p>
        <div className="flex gap-2">
          {Object.entries(LOCALE_NAMES).map(([code, name]) => (
            <button key={code} className={seg(locale === code)} onClick={() => set(code)}>
              {name}
            </button>
          ))}
        </div>
      </Card>
      <Card className="space-y-3 p-5">
        <p className="font-bold">{t('theme')}</p>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((m) => (
            <button key={m} className={seg(theme === m)} onClick={() => setTheme(m)}>
              {t(`theme${m[0].toUpperCase()}${m.slice(1)}` as 'themeLight')}
            </button>
          ))}
        </div>
      </Card>
      <Card className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="font-bold">{t('sounds')}</p>
          <p className="text-sm text-muted-foreground">{t('soundsHint')}</p>
        </div>
        <Switch checked={sounds} onCheckedChange={setSounds} aria-label={t('sounds')} />
      </Card>
    </main>
  );
}
