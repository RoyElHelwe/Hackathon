'use client';

import { Grid3x3, LayoutDashboard, School, Settings, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdultShell } from '@/components/app/adult-shell';
import { RoleGate } from '@/components/app/role-gate';

export default function DirectorLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('director.nav');
  return (
    <RoleGate roles={['DIRECTOR', 'ADMIN']}>
      <AdultShell
        home="/director"
        nav={[
          { href: '/director', label: t('overview'), icon: LayoutDashboard, exact: true },
          { href: '/director/coverage', label: t('coverage'), icon: Grid3x3 },
          { href: '/director/classes', label: t('classes'), icon: School },
          { href: '/director/members', label: t('members'), icon: Users },
          { href: '/director/settings', label: t('settings'), icon: Settings },
        ]}
      >
        {children}
      </AdultShell>
    </RoleGate>
  );
}
