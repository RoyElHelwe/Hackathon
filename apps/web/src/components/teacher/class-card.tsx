'use client';

import { ChevronRight, ClipboardList, Link2, RefreshCw, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import type { ClassSummary } from '@/lib/types';
import { useRelativeTime } from './use-relative-time';

export function ClassCard({ cls }: { cls: ClassSummary }) {
  const t = useTranslations('teacher.classes');
  const ago = useRelativeTime();
  return (
    <Link
      href={`/teacher/classes/${cls.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_1px_2px_rgba(20,17,43,0.04),0_8px_24px_-12px_rgba(108,76,241,0.18)] transition-all hover:-translate-y-0.5 hover:border-primary/40"
      data-testid="class-card"
    >
      <div className="relative h-20 bg-gradient-to-br from-violet to-sky">
        <div className="bg-dots absolute inset-0 opacity-40" />
        <span className="absolute bottom-3 start-5 rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-extrabold text-foreground">
          {cls.gradeLevel ? t('grade', { n: cls.gradeLevel }) : t('noGrade')}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-extrabold leading-tight">{cls.name}</h2>
          <ChevronRight className="rtl-flip mt-1 size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cls.classroomCourseId ? (
            <Badge variant="mint">
              <Link2 /> {t('classroomLinked')}
            </Badge>
          ) : (
            <Badge variant="muted">{t('notLinked')}</Badge>
          )}
          {cls.syncError === 'RECONNECT' && <Badge variant="coral">{t('needsReconnect')}</Badge>}
          {cls.settings?.leaderboardEnabled && (
            <Badge variant="sunny">
              <Trophy /> {t('leaderboardOn')}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[14px] bg-muted px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Users className="size-3.5" /> {t('students')}
            </p>
            <p className="text-xl font-extrabold tabular-nums">{cls.studentCount}</p>
          </div>
          <div className="rounded-[14px] bg-muted px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <ClipboardList className="size-3.5" /> {t('missions')}
            </p>
            <p className="text-xl font-extrabold tabular-nums">{cls.missionCount}</p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="size-3.5" />
            {cls.lastSyncedAt ? t('synced', { when: ago(cls.lastSyncedAt) }) : t('neverSynced')}
          </span>
          <span className="flex -space-x-2 rtl:space-x-reverse">
            {cls.teachers.slice(0, 3).map((tc) => (
              <Avatar key={tc.id} name={tc.name} src={tc.avatarUrl} className="size-7 border-2 border-card text-[10px]" />
            ))}
          </span>
        </div>
      </div>
    </Link>
  );
}
