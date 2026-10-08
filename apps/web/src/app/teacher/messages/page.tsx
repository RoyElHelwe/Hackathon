'use client';

import { useTranslations } from 'next-intl';
import { use } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { MessagesView } from '@/components/app/messages-view';

export default function TeacherMessagesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const sp = use(searchParams);
  const t = useTranslations('teacher.messages');
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <MessagesView initialWith={sp.with} />
    </div>
  );
}
