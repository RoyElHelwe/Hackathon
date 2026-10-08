import { getTranslations } from 'next-intl/server';
import { Bousla } from '@/components/bousla';

export default async function Offline() {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Bousla mood="sleepy" size={140} />
      <h1 className="font-display text-3xl font-extrabold">{t('offlineTitle')}</h1>
      <p className="max-w-sm text-muted-foreground">{t('offlineBody')}</p>
    </main>
  );
}
