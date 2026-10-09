'use client';

import { BookOpen, CalendarDays, Contact, Grid3x3, HeartHandshake, LayoutDashboard, MessageCircle, School, Settings, Sparkles, Users } from 'lucide-react';
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
          { href: '/director', label: t('overview'), icon: LayoutDashboard, exact: true, tone: 'flag' },
          { href: '/director/ask', label: t('ask'), icon: Sparkles, tone: 'cedar' },
          { href: '/director/timetable', label: t('timetable'), icon: CalendarDays, tone: 'med' },
          { href: '/director/roster', label: t('roster'), icon: Contact, tone: 'cedar' },
          { href: '/director/parents', label: t('parents'), icon: HeartHandshake, tone: 'flame' },
          { href: '/director/messages', label: t('messages'), icon: MessageCircle, tone: 'med' },
          { href: '/director/classes', label: t('classes'), icon: School, tone: 'flag' },
          { href: '/director/coverage', label: t('coverage'), icon: Grid3x3, tone: 'cedar' },
          { href: '/director/subjects', label: t('subjects'), icon: BookOpen, tone: 'med' },
          { href: '/director/members', label: t('members'), icon: Users, tone: 'flame' },
          { href: '/director/settings', label: t('settings'), icon: Settings, tone: 'ink' },
        ]}
      >
        {children}
      </AdultShell>
    </RoleGate>
  );
}
