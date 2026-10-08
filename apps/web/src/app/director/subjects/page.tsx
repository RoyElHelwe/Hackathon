'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { SubjectChip } from '@/components/director/subject-chip';
import { SubjectForm, type SubjectFormValue } from '@/components/director/subject-form';
import { useToast } from '@/components/director/toast';
import type { SchoolSubject } from '@/components/director/types';
import { useSchoolId } from '@/components/director/use-school';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';

export default function SubjectsPage() {
  const t = useTranslations('director.subjects');
  const tc = useTranslations('common');
  const locale = useLocale();
  const schoolId = useSchoolId();
  const q = useApi<SchoolSubject[]>(schoolId ? `/schools/${schoolId}/subjects` : null);
  const { toast, node } = useToast();

  const [addKey, setAddKey] = useState(0);
  const [addBusy, setAddBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (q.isLoading || !schoolId) return <PageSkeleton />;
  if (q.error) return <ErrorState message={q.error instanceof ApiError ? q.error.message : undefined} onRetry={() => q.refetch()} />;

  const subjects = q.data ?? [];
  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : tc('error'));

  const addSubject = async (v: SubjectFormValue) => {
    setAddBusy(true);
    try {
      await api(`/schools/${schoolId}/subjects`, { body: v });
      await q.refetch();
      setAddKey((k) => k + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setAddBusy(false);
    }
  };

  const editSubject = async (id: string, v: SubjectFormValue) => {
    setEditBusy(true);
    try {
      await api(`/schools/${schoolId}/subjects/${id}`, { method: 'PATCH', body: v });
      await q.refetch();
      setEditingId(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setEditBusy(false);
    }
  };

  const deleteSubject = async (s: SchoolSubject) => {
    setDeletingId(s.id);
    try {
      await api(`/schools/${schoolId}/subjects/${s.id}`, { method: 'DELETE' });
      await q.refetch();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="space-y-5">
        <Card data-testid="subject-add-card">
          <CardHeader>
            <CardTitle>{t('add')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectForm key={addKey} busy={addBusy} onSubmit={addSubject} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {subjects.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground" data-testid="subjects-empty">
                {t('empty')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {subjects.map((s) => (
                  <li key={s.id} className="p-4" data-testid="subject-row">
                    {editingId === s.id ? (
                      <SubjectForm initial={{ name: s.name.en, color: s.color, icon: s.icon }} busy={editBusy} onSubmit={(v) => editSubject(s.id, v)} onCancel={() => setEditingId(null)} />
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <SubjectChip name={s.name} color={s.color} locale={locale} />
                        <span className="text-sm text-muted-foreground">{t('classes', { n: s.classCount })}</span>
                        <span className="text-sm text-muted-foreground">{t('teachers', { n: s.teacherCount })}</span>
                        <div className="ms-auto flex items-center gap-1">
                          <Button variant="ghost" size="icon" aria-label={t('rename')} onClick={() => setEditingId(s.id)} data-testid="subject-edit">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('delete')}
                            disabled={s.classCount > 0 || deletingId === s.id}
                            title={s.classCount > 0 ? t('deleteBlocked') : undefined}
                            onClick={() => deleteSubject(s)}
                            data-testid="subject-delete"
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {node}
    </div>
  );
}
