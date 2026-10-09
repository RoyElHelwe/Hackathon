'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/app/states';

// Public on purpose: the first page to open on a headset, before signing in.
const DeviceCheck = dynamic(() => import('@/components/vr/device-check'), { ssr: false, loading: () => <PageSkeleton /> });

export default function VRCheckPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeviceCheck />
    </Suspense>
  );
}
