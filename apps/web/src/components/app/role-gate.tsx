'use client';

import type { Role } from '@tajriba/shared';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { LocaleSync } from './locale-sync';
import { PageSkeleton } from './states';

/** Client-side mirror of the API permissions: redirects users who don't have the active role. */
export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { data: me, error, isLoading } = useMe();
  const router = useRouter();
  const allowed = !!me?.active && roles.includes(me.active.role);

  useEffect(() => {
    if (isLoading) return;
    if (error instanceof ApiError && error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (me && !allowed) {
      const other = me.memberships.find((m) => m.status === 'APPROVED' && roles.includes(m.role));
      if (!other) router.replace(me.home);
    }
  }, [isLoading, error, me, allowed, roles, router]);

  if (!allowed) {
    if (me && !allowed) {
      const other = me.memberships.find((m) => m.status === 'APPROVED' && roles.includes(m.role));
      if (other) return <SwitchPrompt membershipId={other.id} />;
    }
    return <PageSkeleton />;
  }
  return (
    <>
      <LocaleSync />
      {children}
    </>
  );
}

function SwitchPrompt({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/me/active-role', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membershipId }) }).then(() => {
      window.location.reload();
    });
  }, [membershipId, router]);
  return <PageSkeleton />;
}
