'use client';

import { Check, GraduationCap, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';
import { errMessage } from './helpers';
import { ReconnectBanner } from './reconnect-banner';
import type { CoursesResponse, ImportResult } from './types';

/** Step 2 of onboarding: choose Classroom courses to import. */
export function CoursePicker({ onImported }: { onImported: (r: ImportResult[]) => void }) {
  const t = useTranslations('teacher.onboarding');
  const { data, isLoading, error, refetch } = useApi<CoursesResponse>('/classroom/courses');
  const invalidate = useInvalidate();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!data) return null;
  if (data.reconnect || !data.connected) return <ReconnectBanner />;

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const doImport = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api<ImportResult[]>('/classroom/import', { body: { courseIds: selected } });
      await invalidate('/classes', '/classroom/courses');
      onImported(res);
    } catch (e) {
      setErr(errMessage(e, t('importError')));
    } finally {
      setBusy(false);
    }
  };

  if (!data.courses.length) return <p className="rounded-[16px] bg-muted p-6 text-center font-semibold text-muted-foreground">{t('noCourses')}</p>;

  return (
    <div>
      <ul className="space-y-3">
        {data.courses.map((c) => {
          const checked = c.imported || selected.includes(c.id);
          return (
            <li key={c.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-[18px] border-2 p-4 transition-colors',
                  c.imported ? 'cursor-default border-border bg-muted/60' : checked ? 'border-primary bg-violet-soft/60' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  disabled={c.imported}
                  onChange={() => toggle(c.id)}
                  data-testid={`course-checkbox-${c.id}`}
                />
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-[8px] border-2 peer-focus-visible:ring-4 peer-focus-visible:ring-ring/40',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                    c.imported && 'border-muted-foreground/40 bg-muted-foreground/40',
                  )}
                  aria-hidden
                >
                  {checked && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-violet-soft text-primary dark:text-white">
                  <GraduationCap className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{c.name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {c.section && <span>{c.section} ·</span>}
                    <Users className="size-3.5" /> {t('studentCount', { n: c.studentCount })}
                  </span>
                </span>
                {c.imported && <Badge variant="muted">{t('alreadyImported')}</Badge>}
              </label>
            </li>
          );
        })}
      </ul>
      {err && (
        <p className="mt-4 rounded-[14px] bg-coral-soft px-4 py-3 text-sm font-bold text-danger" role="alert">
          {err}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('rosterNote')}</p>
        <Button size="lg" onClick={doImport} disabled={!selected.length} loading={busy} data-testid="import-classes">
          {selected.length ? t('importN', { n: selected.length }) : t('importNone')}
        </Button>
      </div>
    </div>
  );
}
