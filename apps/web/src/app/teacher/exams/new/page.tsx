'use client';

import { EXAM_DURATION, questionCountFor } from '@tajriba/shared';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import type { CourseLesson } from '@/components/teacher/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Slider } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import type { ClassSummary } from '@/lib/types';
import { cn } from '@/lib/cn';
import { useApi, useInvalidate } from '@/lib/hooks';

/** "2026-10-09T14:30" in local time for <input type="datetime-local">. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewExamPage() {
  const t = useTranslations('campus.teacher.form');
  const router = useRouter();
  const invalidate = useInvalidate();
  const classes = useApi<ClassSummary[]>('/classes');
  const [classId, setClassId] = useState('');
  const cls = classes.data?.find((c) => c.id === classId);
  const lessons = useApi<CourseLesson[]>(cls?.courseId ? `/courses/${cls.courseId}/lessons` : null);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<number>(EXAM_DURATION.default);
  const [opensAt, setOpensAt] = useState(() => localInput(new Date()));
  const [closesAt, setClosesAt] = useState(() => localInput(new Date(Date.now() + 7 * 86_400_000)));
  const [locale, setLocale] = useState<'en' | 'ar'>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0].id);
  }, [classes.data, classId]);
  useEffect(() => setPicked([]), [classId]);
  const usable = useMemo(() => lessons.data ?? [], [lessons.data]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const create = async () => {
    if (!picked.length) return setError(t('pickLesson'));
    setBusy(true);
    setError(null);
    try {
      const exam = await api<{ id: string }>('/exams', {
        body: { classId, lessonIds: picked, title: title.trim() || usable.filter((l) => picked.includes(l.id)).map((l) => l.title).join(' · ').slice(0, 100), durationMin: duration, opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString(), locale },
      });
      await invalidate('/exams');
      router.push(`/teacher/exams/${exam.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  if (classes.isLoading) return <PageSkeleton />;
  if (classes.error) return <ErrorState onRetry={() => classes.refetch()} />;

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('title')} />
      <Card className="space-y-5 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="exam-class">{t('class')}</Label>
          <Select id="exam-class" value={classId} onChange={(e) => setClassId(e.target.value)} data-testid="exam-class">
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('lessons')}</Label>
          <p className="text-xs text-muted-foreground">{t('lessonsHint')}</p>
          {lessons.isLoading ? (
            <PageSkeleton />
          ) : !usable.length ? (
            <p className="rounded-[12px] bg-muted p-3 text-sm">{t('noLessons')}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="lesson-picker">
              {usable.map((l) => {
                const on = picked.includes(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => toggle(l.id)}
                      aria-pressed={on}
                      className={cn('flex w-full items-start gap-2 rounded-[14px] border-2 p-3 text-start transition-colors', on ? 'border-primary bg-violet-soft' : 'border-border hover:bg-muted')}
                      data-testid="lesson-option"
                    >
                      <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-black', on ? 'border-primary bg-primary text-white' : 'border-border')}>{on ? '✓' : ''}</span>
                      <span className="min-w-0">
                        <span className="block font-bold">{l.title}</span>
                        {l.description && <span className="line-clamp-2 text-xs text-muted-foreground">{l.description}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="exam-title">{t('name')}</Label>
          <Input id="exam-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('namePlaceholder')} maxLength={120} data-testid="exam-title" />
        </div>

        <div className="space-y-1.5">
          <Label>{t('duration')}</Label>
          <Slider min={EXAM_DURATION.min} max={EXAM_DURATION.max} step={1} value={[duration]} onValueChange={(v) => setDuration(v[0])} aria-label={t('duration')} />
          <p className="text-sm font-bold text-primary" data-testid="duration-value">{t('durationValue', { min: duration, n: questionCountFor(duration) })}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="exam-opens">{t('opensAt')}</Label>
            <Input id="exam-opens" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exam-closes">{t('closesAt')}</Label>
            <Input id="exam-closes" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exam-locale">{t('language')}</Label>
            <Select id="exam-locale" value={locale} onChange={(e) => setLocale(e.target.value as 'en' | 'ar')}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <Button size="lg" onClick={create} loading={busy} disabled={!classId || !usable.length} data-testid="create-exam">
          <Sparkles /> {t('create')}
        </Button>
      </Card>
    </div>
  );
}
