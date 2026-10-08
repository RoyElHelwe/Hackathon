'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { MessagesView } from '@/components/app/messages-view';

export default function ParentMessagesPage() {
  const t = useTranslations('parent.messages');
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <MessagesView />
    </div>
  );
}
