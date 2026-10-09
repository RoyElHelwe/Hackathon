'use client';

import { useTranslations } from 'next-intl';
import { MessagesView } from '@/components/app/messages-view';
import { PageHero } from '@/components/director/page-hero';

export default function ParentMessagesPage() {
  const t = useTranslations('parent.messages');
  return (
    <div>
      <PageHero mood="writing" accent="flame" size={96} title={t('title')} subtitle={t('subtitle')} />
      <MessagesView />
    </div>
  );
}
