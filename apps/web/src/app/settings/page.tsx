'use client';

import { ChevronLeft, Languages, Monitor, Moon, Sun, Volume2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Arzino } from '@/components/arzino';
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
  const seg = (active: boolean) =>
    cn(
      'flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-2 text-[15px] font-extrabold transition-[transform,box-shadow,colors] active:translate-y-[3px] active:shadow-none [&_svg]:size-4',
      active ? 'border-med bg-med-soft text-med-ink shadow-[0_3px_0_var(--med)] dark:text-white' : 'border-border bg-card shadow-[0_3px_0_var(--border)] hover:bg-muted',
    );
  const themes = [
    { id: 'light' as const, icon: Sun, label: t('themeLight') },
    { id: 'dark' as const, icon: Moon, label: t('themeDark') },
    { id: 'system' as const, icon: Monitor, label: t('themeSystem') },
  ];

  return (
    <main className="mx-auto max-w-lg space-y-4 bg-background p-4 pb-16">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-[15px] font-black uppercase tracking-[0.08em] text-med-ink hover:text-med dark:text-med">
        <ChevronLeft className="rtl-flip size-5" /> {t('back')}
      </button>
      <div className="flex items-center gap-4">
        <Arzino mood="embarrassed" size={110} />
        <div>
          <h1 className="font-display text-[30px] leading-tight">{t('settingsTitle')}</h1>
          <p className="text-muted-foreground">{t('settingsSubtitle')}</p>
        </div>
      </div>

      <Card className="space-y-3 p-5">
        <Row icon={Languages} tone="bg-cedar-soft text-cedar-ink dark:text-success" title={t('language')} hint={t('languageHint')} />
        <div className="flex gap-2">
          {Object.entries(LOCALE_NAMES).map(([code, name]) => (
            <button key={code} className={seg(locale === code)} onClick={() => set(code)} aria-pressed={locale === code}>
              {name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <Row icon={Moon} tone="bg-med-soft text-med-ink dark:text-white" title={t('theme')} hint={t('themeHint')} />
        <div className="flex gap-2">
          {themes.map((m) => (
            <button key={m.id} className={seg(theme === m.id)} onClick={() => setTheme(m.id)} aria-pressed={theme === m.id}>
              <m.icon /> {m.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-4 p-5">
        <Row icon={Volume2} tone="bg-flame-soft text-flame-d dark:text-warning" title={t('sounds')} hint={t('soundsHint')} />
        <Switch checked={sounds} onCheckedChange={setSounds} aria-label={t('sounds')} />
      </Card>
    </main>
  );
}

function Row({ icon: Icon, tone, title, hint }: { icon: typeof Sun; tone: string; title: string; hint: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-[12px]', tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
