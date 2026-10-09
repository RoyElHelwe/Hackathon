'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';

// Placeholder while the timetable is being built.
export default function TeacherWeekPage() {
  const t = useTranslations('teacher.nav');
  return <PageHeader title={t('week')} mood="teaching" />;
}
