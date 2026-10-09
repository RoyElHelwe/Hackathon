import { WifiOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Arzino } from '@/components/arzino';

export default async function Offline() {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
      <div className="flex w-full max-w-sm items-end justify-center rounded-[28px] bg-muted pt-6">
        <Arzino mood="sleepy" size={220} priority />
      </div>
      <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-lock px-3 py-1 text-xs font-black uppercase tracking-wider text-muted-foreground">
        <WifiOff className="size-4" aria-hidden /> {t('offlineTag')}
      </span>
      <h1 className="mt-3 font-display text-[30px] leading-tight">{t('offlineTitle')}</h1>
      <p className="mt-2 max-w-sm text-lg text-muted-foreground">{t('offlineBody')}</p>
    </main>
  );
}
