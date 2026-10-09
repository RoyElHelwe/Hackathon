'use client';

import { ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import type { ClassStudent } from './types';

export function StudentsTable({ students, classId }: { students: ClassStudent[]; classId: string }) {
  const t = useTranslations('teacher.class');
  if (!students.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t('noStudents')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="eyebrow border-b-2 border-border">
            <th className="py-2 text-start font-bold">{t('colStudent')}</th>
            <th className="px-2 py-2 text-start font-bold">{t('colLevel')}</th>
            <th className="px-2 py-2 text-end font-bold">XP</th>
            <th className="px-2 py-2 text-end font-bold">{t('colMastered')}</th>
            <th className="hidden px-2 py-2 text-start font-bold md:table-cell">{t('colParents')}</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="group border-b-2 border-border last:border-0 hover:bg-muted" data-testid="student-row">
              <td className="py-2.5">
                <Link href={`/teacher/students/${s.id}?classId=${classId}`} className="flex items-center gap-3 font-extrabold group-hover:text-med-d dark:group-hover:text-med">
                  <Avatar name={s.name} src={s.avatarUrl} className="size-9 text-xs" />
                  <span className="truncate">{s.name}</span>
                  {s.status === 'INVITED' && <Badge variant="muted">{t('invited')}</Badge>}
                  {s.enrollment === 'ARCHIVED' && <Badge variant="outline">{t('archived')}</Badge>}
                </Link>
              </td>
              <td className="px-2 py-2.5">
                <Badge variant="sky">{t('level', { n: s.level })}</Badge>
              </td>
              <td className="px-2 py-2.5 text-end font-black tabular-nums">{s.xp}</td>
              <td className="px-2 py-2.5 text-end font-black tabular-nums text-cedar-d dark:text-success">{s.mastered}</td>
              <td className="hidden px-2 py-2.5 md:table-cell">
                {s.parents.length ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-3.5" /> {s.parents.map((p) => p.name).join(', ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70">{t('noParent')}</span>
                )}
              </td>
              <td className="py-2.5">
                <Link href={`/teacher/students/${s.id}?classId=${classId}`} aria-label={s.name}>
                  <ChevronRight className="rtl-flip size-4 text-muted-foreground" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
