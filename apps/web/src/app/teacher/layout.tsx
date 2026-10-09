'use client';

import { BarChart3, ClipboardCheck, Headphones, MessageCircle, MicVocal, School, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdultShell } from '@/components/app/adult-shell';
import { RoleGate } from '@/components/app/role-gate';
import { Toaster } from '@/components/teacher/toast';
import { useApi } from '@/lib/hooks';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('teacher.nav');
  const tc = useTranslations('campus.teacher');
  const { data: queue } = useApi<{ status: string }[]>('/teacher/review-queue');
  const pending = queue?.filter((q) => q.status === 'TEACHER_REVIEW').length ?? 0;
  return (
    <RoleGate roles={['TEACHER']}>
      <AdultShell
        home="/teacher"
        nav={[
          { href: '/teacher', label: t('classes'), icon: School, exact: true, tone: 'flag' },
          { href: '/teacher/missions', label: t('missions'), icon: Wand2, tone: 'med' },
          { href: '/teacher/review', label: t('review'), icon: ClipboardCheck, badge: pending, tone: 'cedar' },
          { href: '/teacher/exams', label: tc('navExams'), icon: MicVocal, tone: 'flame' },
          { href: '/teacher/sessions', label: tc('navSessions'), icon: Headphones, tone: 'med' },
          { href: '/teacher/insights', label: t('insights'), icon: BarChart3, tone: 'ink' },
          { href: '/teacher/messages', label: t('messages'), icon: MessageCircle, tone: 'cedar' },
        ]}
      >
        {children}
        <Toaster />
      </AdultShell>
    </RoleGate>
  );
}
