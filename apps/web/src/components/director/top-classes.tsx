'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EngagementBar } from './engagement-bar';
import { EYEBROW } from './tone';
import type { DirectorClass } from './types';

export function TopClasses({ classes }: { classes: DirectorClass[] }) {
  const t = useTranslations('director.overview');
  const tc = useTranslations('director.classes');
  const top = [...classes].sort((a, b) => b.engagement - a.engagement || b.avgMastery - a.avgMastery).slice(0, 4);
  return (
    <Card className="h-full" data-testid="top-classes">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardDescription className={EYEBROW}>{t('topClassesSubtitle')}</CardDescription>
          <CardTitle className="mt-1 text-xl">{t('topClasses')}</CardTitle>
        </div>
        <Link href="/director/classes" className="inline-flex shrink-0 items-center gap-1 text-sm font-black uppercase tracking-[0.08em] text-med-ink hover:underline dark:text-ring">
          {t('allClasses')} <ArrowRight className="size-4 rtl-flip" />
        </Link>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-muted-foreground">{t('noClasses')}</p>
        ) : (
          <ul className="grid gap-2">
            {top.map((c, i) => (
              <li key={c.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-[16px] bg-muted px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,11rem)]">
                <span className="flex size-8 items-center justify-center rounded-full bg-card font-black tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-black">
                    {c.name}
                    {c.stuckCount > 0 && (
                      <Badge variant="coral">
                        <AlertTriangle /> {tc('stuckCount', { n: c.stuckCount })}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-sm font-semibold text-muted-foreground">
                    {c.teachers.join(', ')} · {c.students} {tc('students').toLowerCase()} · {tc('mastery')} {c.avgMastery}%
                  </p>
                </div>
                <EngagementBar value={c.engagement} className="col-span-2 sm:col-span-1" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
