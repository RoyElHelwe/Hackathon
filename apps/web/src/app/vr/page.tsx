'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { RoleGate } from '@/components/app/role-gate';
import { PageSkeleton } from '@/components/app/states';

// three.js + WebXR only load on this page (and only in the browser)
const VRApp = dynamic(() => import('@/components/vr/vr-app'), { ssr: false, loading: () => <PageSkeleton /> });

export default function VRPage() {
  return (
    <RoleGate roles={['STUDENT']}>
      <Suspense fallback={<PageSkeleton />}>
        <VRApp />
      </Suspense>
    </RoleGate>
  );
}
