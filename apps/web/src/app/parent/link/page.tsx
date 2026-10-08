'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { LinkChild } from '@/components/parent/link-child';

export default function LinkChildPage() {
  const t = useTranslations('parent.link');
  return (
    <div>
      <div className="mx-auto max-w-md text-center [&>div]:justify-center">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
      </div>
      <LinkChild />
    </div>
  );
}
