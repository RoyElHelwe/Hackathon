'use client';

import { Heart, Home, Link2, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdultShell } from '@/components/app/adult-shell';
import { RoleGate } from '@/components/app/role-gate';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('parent.nav');
  return (
    <RoleGate roles={['PARENT']}>
      <AdultShell
        home="/parent"
        nav={[
          { href: '/parent', label: t('home'), icon: Home, exact: true },
          { href: '/parent/family', label: t('family'), icon: Heart },
          { href: '/parent/messages', label: t('messages'), icon: MessageCircle },
          { href: '/parent/link', label: t('link'), icon: Link2 },
        ]}
      >
        {children}
      </AdultShell>
    </RoleGate>
  );
}
