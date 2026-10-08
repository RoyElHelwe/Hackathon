'use client';

import { Check, GraduationCap, Layers, Sparkles, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { subjectLabel } from '@/components/director/subject-chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';
import { errMessage } from './helpers';
import { ReconnectBanner } from './reconnect-banner';
import type { ClassroomCourse, CoursesResponse, ImportResult } from './types';

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

interface RowState {
  subjectId: string;
  gradeLevel: number | null;
  sectionLabel: string;
}

const fromSuggestion = (c: ClassroomCourse): RowState => ({
  subjectId: c.suggestion?.subjectId ?? '',
  gradeLevel: c.suggestion?.gradeLevel ?? null,
  sectionLabel: c.suggestion?.sectionLabel ?? '',
});

/** Step 2 of onboarding: choose Classroom courses, check the AI's subject + grade per section, import grouped into courses. */
export function CoursePicker({ onImported }: { onImported: (r: ImportResult[]) => void }) {
  const t = useTranslations('teacher.onboarding');
  const tc = useTranslations('teacher.courses');
  const locale = useLocale();
  const { data, isLoading, error, refetch } = useApi<CoursesResponse>('/classroom/courses');
  const invalidate = useInvalidate();
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, RowState>>({});
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
  if (!data.courses.length) return <p className="rounded-[16px] bg-muted p-6 text-center font-semibold text-muted-foreground">{t('noCourses')}</p>;

  const subjects = data.subjects ?? [];
  const noSubjects = subjects.length === 0;
  const row = (c: ClassroomCourse) => edits[c.id] ?? fromSuggestion(c);
  const setRow = (c: ClassroomCourse, patch: Partial<RowState>) => setEdits((e) => ({ ...e, [c.id]: { ...row(c), ...patch } }));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const subjectName = (id: string) => subjectLabel(subjects.find((s) => s.id === id)?.name, locale);

  const chosen = data.courses.filter((c) => !c.imported && selected.includes(c.id));
  const incomplete = chosen.filter((c) => !row(c).subjectId || !row(c).gradeLevel);
  const canImport = chosen.length > 0 && incomplete.length === 0 && !noSubjects;

  // Live preview: selected sections grouped by (subject, grade).
  const groups = new Map<string, { subjectId: string; grade: number; count: number }>();
  for (const c of chosen) {
    const r = row(c);
    if (!r.subjectId || !r.gradeLevel) continue;
    const key = `${r.subjectId}:${r.gradeLevel}`;
    const g = groups.get(key) ?? { subjectId: r.subjectId, grade: r.gradeLevel, count: 0 };
    g.count++;
    groups.set(key, g);
  }
  const existing = (g: { subjectId: string; grade: number }) => data.schoolCourses?.some((sc) => sc.subjectId === g.subjectId && sc.gradeLevel === g.grade);

  const doImport = async () => {
    setBusy(true);
    setErr(null);
    try {
      const items = chosen.map((c) => {
        const r = row(c);
        return { courseId: c.id, subjectId: r.subjectId, gradeLevel: r.gradeLevel!, sectionLabel: r.sectionLabel.trim() || null };
      });
      const res = await api<ImportResult[]>('/classroom/import', { body: { items } });
      await invalidate('/classes', '/courses', '/classroom/courses');
      onImported(res);
    } catch (e) {
      setErr(errMessage(e, t('importError')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {noSubjects && (
        <p className="mb-4 rounded-[14px] bg-sunny-soft px-4 py-3 text-sm font-bold text-warning" role="status" data-testid="no-subjects">
          {tc('noSubjects')}
        </p>
      )}
      <ul className="space-y-3">
        {data.courses.map((c) => {
          const checked = c.imported || selected.includes(c.id);
          const r = row(c);
          const active = !c.imported && selected.includes(c.id);
          const aiFilled = !edits[c.id] && !!(c.suggestion?.subjectId || c.suggestion?.gradeLevel);
          return (
            <li
              key={c.id}
              className={cn(
                'rounded-[18px] border-2 transition-colors',
                c.imported ? 'border-border bg-muted/60' : checked ? 'border-primary bg-violet-soft/60' : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <label className={cn('flex items-center gap-4 p-4', c.imported ? 'cursor-default' : 'cursor-pointer')}>
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
              {active && !noSubjects && (
                <div className="grid gap-3 border-t border-primary/20 px-4 pb-4 pt-3 sm:grid-cols-[1fr_9rem_7rem]">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground" htmlFor={`subject-${c.id}`}>
                      {tc('subject')}
                      {aiFilled && (
                        <span className="inline-flex items-center gap-0.5 text-primary">
                          <Sparkles className="size-3" /> {tc('aiSuggested')}
                        </span>
                      )}
                    </label>
                    <Select
                      id={`subject-${c.id}`}
                      className="h-10 text-sm"
                      value={r.subjectId}
                      onChange={(e) => setRow(c, { subjectId: e.target.value })}
                      data-testid={`course-subject-${c.id}`}
                    >
                      <option value="">{tc('pickSubject')}</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {subjectLabel(s.name, locale)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-muted-foreground" htmlFor={`grade-${c.id}`}>
                      {tc('gradeLabel')}
                    </label>
                    <Select
                      id={`grade-${c.id}`}
                      className="h-10 text-sm"
                      value={r.gradeLevel ?? ''}
                      onChange={(e) => setRow(c, { gradeLevel: e.target.value ? Number(e.target.value) : null })}
                      data-testid={`course-grade-${c.id}`}
                    >
                      <option value="">{tc('pickGrade')}</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {tc('grade', { n: g })}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-muted-foreground" htmlFor={`section-${c.id}`}>
                      {tc('section')}
                    </label>
                    <Input
                      id={`section-${c.id}`}
                      className="h-10 text-sm"
                      maxLength={20}
                      value={r.sectionLabel}
                      placeholder={tc('sectionPlaceholder')}
                      onChange={(e) => setRow(c, { sectionLabel: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {groups.size > 0 && (
        <div className="mt-5 rounded-[16px] border border-border bg-card p-4" data-testid="import-preview">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold">
            <Layers className="size-4 text-primary" /> {tc('previewTitle')}
          </p>
          <ul className="space-y-1.5 text-sm">
            {[...groups.values()].map((g) => (
              <li key={`${g.subjectId}:${g.grade}`} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{tc('title', { grade: g.grade, subject: subjectName(g.subjectId) })}</span>
                <span className="text-muted-foreground">— {tc('sectionCount', { n: g.count })}</span>
                {existing(g) && <Badge variant="mint">{tc('joinsExisting')}</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && (
        <p className="mt-4 rounded-[14px] bg-coral-soft px-4 py-3 text-sm font-bold text-danger" role="alert">
          {err}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{incomplete.length > 0 ? tc('completeRows') : t('rosterNote')}</p>
        <Button size="lg" onClick={doImport} disabled={!canImport} loading={busy} data-testid="import-classes">
          {chosen.length ? t('importN', { n: chosen.length }) : t('importNone')}
        </Button>
      </div>
    </div>
  );
}
