'use client';

import { BarChart3, ClipboardCheck, MessageCircle, School, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdultShell } from '@/components/app/adult-shell';
import { RoleGate } from '@/components/app/role-gate';
import { useApi } from '@/lib/hooks';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('teacher.nav');
  const { data: queue } = useApi<{ status: string }[]>('/teacher/review-queue');
  const pending = queue?.filter((q) => q.status === 'TEACHER_REVIEW').length ?? 0;
  return (
    <RoleGate roles={['TEACHER']}>
      <AdultShell
        home="/teacher"
        nav={[
          { href: '/teacher', label: t('classes'), icon: School, exact: true },
          { href: '/teacher/missions', label: t('missions'), icon: Wand2 },
          { href: '/teacher/review', label: t('review'), icon: ClipboardCheck, badge: pending },
          { href: '/teacher/insights', label: t('insights'), icon: BarChart3 },
          { href: '/teacher/messages', label: t('messages'), icon: MessageCircle },
        ]}
      >
        {children}
      </AdultShell>
    </RoleGate>
  );
}
