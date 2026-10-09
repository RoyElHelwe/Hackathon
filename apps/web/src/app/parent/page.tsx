'use client';

import { Link2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { ChildDashboard } from '@/components/parent/child-dashboard';
import { ChildExams } from '@/components/parent/child-exams';
import { ChildSwitcher } from '@/components/parent/child-switcher';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/hooks';

export default function ParentHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ParentHome />
    </Suspense>
  );
}

function ParentHome() {
  const t = useTranslations('parent.dashboard');
  const { data: me, isLoading, error, refetch } = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  if (isLoading) return <PageSkeleton />;
  if (error || !me) return <ErrorState onRetry={() => refetch()} />;

  const kids = me.children;
  if (!kids.length) {
    return (
      <EmptyState
        mood="warm"
        title={t('noChildrenTitle')}
        body={t('noChildrenBody')}
        className="py-16"
        action={
          <Button asChild variant="kid" size="pill">
            <Link href="/parent/link">
              <Link2 /> {t('linkChild')}
            </Link>
          </Button>
        }
      />
    );
  }

  const selected = kids.find((k) => k.id === params.get('child')) ?? kids[0];
  const select = (id: string) => router.replace(`${pathname}?child=${id}`, { scroll: false });

  return (
    <div className="mx-auto max-w-6xl">
      <ChildSwitcher items={kids} value={selected.id} onChange={select} />
      <ChildDashboard key={selected.id} studentId={selected.id} />
      <ChildExams key={`exams-${selected.id}`} studentId={selected.id} />
    </div>
  );
}
