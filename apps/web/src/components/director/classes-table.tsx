'use client';

import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { EngagementBar } from './engagement-bar';
import type { DirectorClass } from './types';

export function ClassesTable({ classes }: { classes: DirectorClass[] }) {
  const t = useTranslations('director.classes');
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm" data-testid="classes-table">
        <thead>
          <tr className="border-b-2 border-border bg-muted text-[12px] font-black uppercase tracking-[0.09em] text-muted-foreground">
            <th scope="col" className="px-4 py-3 text-start">{t('name')}</th>
            <th scope="col" className="px-4 py-3 text-start">{t('teachers')}</th>
            <th scope="col" className="px-4 py-3 text-end">{t('students')}</th>
            <th scope="col" className="w-48 px-4 py-3 text-start">{t('engagement')}</th>
            <th scope="col" className="w-48 px-4 py-3 text-start">{t('mastery')}</th>
            <th scope="col" className="px-4 py-3 text-start">{t('stuck')}</th>
            <th scope="col" className="px-4 py-3 text-start">{t('classroom')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {classes.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-muted/60" data-testid="class-row">
              <td className="px-4 py-3">
                <p className="text-base font-black">{c.name}</p>
                {c.gradeLevel != null && <p className="text-xs font-bold text-muted-foreground">{t('grade', { n: c.gradeLevel })}</p>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  {c.teachers.map((name) => (
                    <span key={name} className="flex items-center gap-2 font-semibold">
                      <Avatar name={name} className="size-7 text-[11px]" />
                      {name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-end text-base font-black tabular-nums">{c.students}</td>
              <td className="px-4 py-3">
                <EngagementBar value={c.engagement} />
              </td>
              <td className="px-4 py-3">
                <EngagementBar value={c.avgMastery} />
              </td>
              <td className="px-4 py-3">
                {c.stuckCount > 0 ? (
                  <Badge variant="coral" data-testid="stuck-badge">
                    <AlertTriangle /> {t('stuckCount', { n: c.stuckCount })}
                  </Badge>
                ) : (
                  <span className="font-bold text-muted-foreground">{t('none')}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {c.classroomLinked ? (
                  <Badge variant="mint">
                    <CheckCircle2 /> {t('linked')}
                  </Badge>
                ) : (
                  <Badge variant="muted">
                    <CircleDashed /> {t('notLinked')}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

