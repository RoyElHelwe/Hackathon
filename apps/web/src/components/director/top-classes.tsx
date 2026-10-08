'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EngagementBar } from './engagement-bar';
import type { DirectorClass } from './types';

export function TopClasses({ classes }: { classes: DirectorClass[] }) {
  const t = useTranslations('director.overview');
  const tc = useTranslations('director.classes');
  const top = [...classes].sort((a, b) => b.engagement - a.engagement || b.avgMastery - a.avgMastery).slice(0, 4);
  return (
    <Card className="h-full" data-testid="top-classes">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{t('topClasses')}</CardTitle>
          <CardDescription>{t('topClassesSubtitle')}</CardDescription>
        </div>
        <Link href="/director/classes" className="text-sm font-bold text-primary hover:underline dark:text-white">
          {t('allClasses')}
        </Link>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('noClasses')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] items-center gap-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-extrabold">
                    {c.name}
                    {c.stuckCount > 0 && (
                      <Badge variant="coral">
                        <AlertTriangle /> {tc('stuckCount', { n: c.stuckCount })}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.teachers.join(', ')} · {c.students} {tc('students').toLowerCase()} · {tc('mastery')} {c.avgMastery}%
                  </p>
                </div>
                <EngagementBar value={c.engagement} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
