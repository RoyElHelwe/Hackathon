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
      <Link href={`/teacher/classes/${cls.id}`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="rtl-flip size-4" /> {cls.name}
      </Link>

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-5 md:p-6">
          <Avatar name={student.name} src={student.avatarUrl} className="size-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl" data-testid="student-name">
              {student.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{cls.name}</Badge>
              {student.status === 'INVITED' && <Badge variant="muted">{t('invited')}</Badge>}
              {student.enrollment === 'ARCHIVED' && <Badge variant="muted">{t('archived')}</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Trophy className="size-4 text-primary" />} label={t('level')} value={student.level} />
            <Metric icon={<Sparkles className="size-4 text-warning" />} label="XP" value={student.xp} />
            <Metric icon={<Star className="size-4 text-success" />} label={t('mastered')} value={student.mastered} />
          </div>
        </div>
        {stuck.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-coral/30 bg-coral-soft px-5 py-3 text-sm md:px-6" data-testid="student-stuck">
            <AlertTriangle className="size-4 text-danger" />
            {stuck.map((s) => (
              <span key={s.topicId} className="font-semibold">
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
              <CardTitle>{t('skillMap')}</CardTitle>
              <CardDescription>{t('skillMapBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <SkillTiles studentId={id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryList studentId={id} />
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t('family')}</CardTitle>
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
    <div className="min-w-20 rounded-[16px] bg-muted px-3 py-2 text-center">
      <p className="flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground">
        {icon} {label}
      </p>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
