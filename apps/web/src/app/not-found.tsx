import { Home } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Arzino } from '@/components/arzino';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-center">
      <div className="relative flex items-center justify-center">
        <span className="pointer-events-none absolute select-none font-display text-[150px] leading-none text-lock sm:text-[200px]" aria-hidden>
          404
        </span>
        <Arzino mood="shocked" size={220} pop priority className="relative" />
      </div>
      <h1 className="mt-4 max-w-md font-display text-[30px] leading-tight">{t('notFound')}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t('notFoundBody')}</p>
      <Button asChild variant="kid" size="lg" className="mt-7">
        <Link href="/">
          <Home /> {t('backHome')}
        </Link>
      </Button>
    </main>
  );
}
