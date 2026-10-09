'use client';

import { ChevronRight, Link2, RefreshCw, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import type { ClassSummary } from '@/lib/types';
import { SUBJECT_SOLID } from './helpers';
import { useRelativeTime } from './use-relative-time';

/** Class tile: subject-colored header block, two big numbers, Classroom status. */
export function ClassCard({ cls, color }: { cls: ClassSummary; color?: string }) {
  const t = useTranslations('teacher.classes');
  const ago = useRelativeTime();
  return (
    <Link
      href={`/teacher/classes/${cls.id}`}
      className="chunky chunky-hover group flex flex-col overflow-hidden rounded-[20px]"
      data-testid="class-card"
    >
      <div className={cn('relative px-5 pb-4 pt-4 text-white', (color && SUBJECT_SOLID[color]) || 'bg-med')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[22px] font-black leading-tight">{cls.name}</h2>
            <p className="text-sm font-extrabold opacity-90">{cls.gradeLevel ? t('grade', { n: cls.gradeLevel }) : t('noGrade')}</p>
          </div>
          <ChevronRight className="rtl-flip mt-1 size-6 shrink-0 opacity-80 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="eyebrow">{t('students')}</p>
            <p className="font-display text-[28px] font-black leading-tight tabular-nums">{cls.studentCount}</p>
          </div>
          <div>
            <p className="eyebrow">{t('missions')}</p>
            <p className="font-display text-[28px] font-black leading-tight tabular-nums">{cls.missionCount}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cls.classroomCourseId ? (
            <Badge variant="sky">
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
        <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-border pt-3 text-xs font-bold text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <RefreshCw className="size-3.5 shrink-0" />
            <span className="truncate">{cls.lastSyncedAt ? t('synced', { when: ago(cls.lastSyncedAt) }) : t('neverSynced')}</span>
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
