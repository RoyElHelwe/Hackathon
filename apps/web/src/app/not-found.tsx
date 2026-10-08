import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Bousla } from '@/components/bousla';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Bousla mood="curious" size={140} />
      <h1 className="font-display text-3xl font-extrabold">{t('notFound')}</h1>
      <Link href="/" className="font-bold text-primary underline">
        {t('backHome')}
      </Link>
    </main>
  );
}
