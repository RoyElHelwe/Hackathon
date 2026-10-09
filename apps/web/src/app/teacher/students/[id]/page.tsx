'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Sparkles, Star, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { use } from 'react';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { HistoryList } from '@/components/teacher/history-list';
import { ParentsCard } from '@/components/teacher/parents-card';
import { SkillTiles } from '@/components/teacher/skill-tiles';
import type { ClassStudent, TeacherDashboard } from '@/components/teacher/types';
import { Arzino } from '@/components/arzino';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useApi, useL } from '@/lib/hooks';
import type { ClassSummary } from '@/lib/types';

interface Found {
  cls: ClassSummary;
  student: ClassStudent;
}

/** Finds the student in one of my classes (the ?classId hint first). */
async function findStudent(studentId: string, hint?: string): Promise<Found | null> {
  const classes = await api<ClassSummary[]>('/classes');
  const ordered = [...classes].sort((a, b) => Number(b.id === hint) - Number(a.id === hint));
  for (const cls of ordered) {
    const students = await api<ClassStudent[]>(`/classes/${cls.id}/students`);
    const student = students.find((s) => s.id === studentId);
    if (student) return { cls, student };
  }
  return null;
}

export default function TeacherStudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ classId?: string }> }) {
  const { id } = use(params);
  const { classId } = use(searchParams);
  const t = useTranslations('teacher.student');
  const l = useL();
  const found = useQuery({ queryKey: ['teacher-student', id, classId], queryFn: () => findStudent(id, classId) });
  const cid = found.data?.cls.id;
  const dash = useApi<TeacherDashboard>(cid ? `/dashboards/teacher/${cid}` : null);

  if (found.isLoading) return <PageSkeleton />;
  if (found.error) return <ErrorState message={found.error.message} onRetry={() => found.refetch()} />;
  if (!found.data) return <ErrorState message={t('notFound')} />;
  const { cls, student } = found.data;
  const stuck = dash.data?.stuck.filter((s) => s.studentId === id) ?? [];

  return (
    <div>
      <Link href={`/teacher/classes/${cls.id}`} className="mb-4 inline-flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-[0.09em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="rtl-flip size-4" /> {cls.name}
      </Link>

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-5 md:p-6">
          <Avatar name={student.name} src={student.avatarUrl} className="size-20 border-4 border-card text-2xl shadow-[0_0_0_2px_var(--border)]" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[30px] font-black leading-tight tracking-tight md:text-[34px]" data-testid="student-name">
              {student.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{cls.name}</Badge>
              {student.status === 'INVITED' && <Badge variant="muted">{t('invited')}</Badge>}
              {student.enrollment === 'ARCHIVED' && <Badge variant="muted">{t('archived')}</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Trophy className="size-4 text-cedar" />} label={t('level')} value={student.level} />
            <Metric icon={<Sparkles className="size-4 text-med" />} label="XP" value={student.xp} />
            <Metric icon={<Star className="size-4 text-flame" />} label={t('mastered')} value={student.mastered} />
          </div>
        </div>
        {stuck.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t-2 border-flag/30 bg-flag-soft px-5 py-3 text-sm md:px-6" data-testid="student-stuck">
            <Arzino mood="flop-cry" size={56} className="-my-2" />
            <AlertTriangle className="size-4 text-flag" />
            {stuck.map((s) => (
              <span key={s.topicId} className="font-extrabold">
                {t('stuckOn', { topic: l(s.topicName) })} ({s.reasons.map((r) => t(`reason.${r}`)).join(', ')})
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t('skillMap')}</CardTitle>
              <CardDescription>{t('skillMapBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <SkillTiles studentId={id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t('history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryList studentId={id} />
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-xl">{t('family')}</CardTitle>
            <CardDescription>{t('familyBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ParentsCard student={student} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-[16px] border-2 border-border px-3 py-2 text-center">
      <p className="font-display text-[28px] font-black leading-tight tabular-nums">{value}</p>
      <p className="flex items-center justify-center gap-1 text-xs font-extrabold text-muted-foreground">
        {icon} {label}
      </p>
    </div>
  );
}
