'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { MessagesView } from '@/components/app/messages-view';
import { PageSkeleton } from '@/components/app/states';
import { PageHero } from '@/components/director/page-hero';

/** Director ↔ parents conversations (opened from the Parents page with ?with=<parentId>). */
export default function DirectorMessagesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Messages />
    </Suspense>
  );
}

function Messages() {
  const t = useTranslations('director.nav');
  const params = useSearchParams();
  return (
    <div className="space-y-6">
      <PageHero mood="warm" title={t('messages')} accent="flame" />
      <MessagesView initialWith={params.get('with') ?? undefined} />
    </div>
  );
}
