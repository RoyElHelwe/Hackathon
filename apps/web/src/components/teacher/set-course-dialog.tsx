'use client';

import { Layers } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { subjectLabel } from '@/components/director/subject-chip';
import { useSchoolId } from '@/components/director/use-school';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useApi, useInvalidate } from '@/lib/hooks';
import { GRADES } from './course-picker';
import { errMessage } from './helpers';
import { toast } from './toast';
import type { SchoolSubjectOption } from './types';

/** "Set subject & grade" for a section: puts it in the matching course (created on first use). */
export function SetCourseDialog({
  classId,
  initial,
  label,
  variant = 'outline',
}: {
  classId: string;
  initial?: { subjectId?: string | null; gradeLevel?: number | null; sectionLabel?: string | null };
  label?: string;
  variant?: 'outline' | 'default';
}) {
  const t = useTranslations('teacher.courses');
  const locale = useLocale();
  const schoolId = useSchoolId();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const subjects = useApi<SchoolSubjectOption[]>(open && schoolId ? `/schools/${schoolId}/subjects` : null);
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '');
  const [grade, setGrade] = useState<number | null>(initial?.gradeLevel ?? null);
  const [section, setSection] = useState(initial?.sectionLabel ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!subjectId || !grade) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/classes/${classId}/course`, { method: 'PATCH', body: { subjectId, gradeLevel: grade, sectionLabel: section.trim() || null } });
      await invalidate('/classes', '/courses', `/dashboards/teacher/${classId}`);
      toast(t('setSaved'));
      setOpen(false);
    } catch (e) {
      setErr(errMessage(e, t('setError')));
    } finally {
      setBusy(false);
    }
  };

  const list = subjects.data ?? [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" data-testid="set-course">
          <Layers /> {label ?? t('setCta')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t('setTitle')}</DialogTitle>
        <DialogDescription className="mt-1">{t('setBody')}</DialogDescription>
        <div className="mt-5 space-y-4">
          {subjects.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loadingSubjects')}</p>
          ) : subjects.error ? (
            <p className="text-sm font-bold text-danger">{subjects.error.message}</p>
          ) : !list.length ? (
            <p className="rounded-[14px] bg-sunny-soft px-4 py-3 text-sm font-bold text-warning">{t('noSubjects')}</p>
          ) : (
            <>
              <div>
                <Label htmlFor={`set-subject-${classId}`}>{t('subject')}</Label>
                <Select id={`set-subject-${classId}`} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} data-testid="set-course-subject">
                  <option value="">{t('pickSubject')}</option>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {subjectLabel(s.name, locale)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`set-grade-${classId}`}>{t('gradeLabel')}</Label>
                  <Select id={`set-grade-${classId}`} value={grade ?? ''} onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : null)} data-testid="set-course-grade">
                    <option value="">{t('pickGrade')}</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {t('grade', { n: g })}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`set-section-${classId}`}>{t('sectionOptional')}</Label>
                  <Input id={`set-section-${classId}`} maxLength={20} value={section} placeholder={t('sectionPlaceholder')} onChange={(e) => setSection(e.target.value)} />
                </div>
              </div>
            </>
          )}
          {err && (
            <p className="rounded-[14px] bg-coral-soft px-4 py-3 text-sm font-bold text-danger" role="alert">
              {err}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={save} disabled={!subjectId || !grade} loading={busy} data-testid="set-course-save">
              {t('setSave')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
