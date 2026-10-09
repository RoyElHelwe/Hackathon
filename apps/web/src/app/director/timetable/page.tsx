'use client';

import { useTranslations } from 'next-intl';
import { PageHero } from '@/components/director/page-hero';

// Placeholder while the director suite is being built.
export default function Page() {
  const t = useTranslations('timetable');
  return <PageHero mood="bored-waiting" title={t('title')} />;
}
