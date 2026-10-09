'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/app/states';
import { PageHero } from '@/components/director/page-hero';
import { subjectLabel, SubjectChip } from '@/components/director/subject-chip';
import { SubjectForm, type SubjectFormValue } from '@/components/director/subject-form';
import { useToast } from '@/components/director/toast';
import type { SchoolSubject } from '@/components/director/types';
import { useSchoolId } from '@/components/director/use-school';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
  const [confirming, setConfirming] = useState<SchoolSubject | null>(null);

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

  const editSubject = async (id: string, initialName: string, v: SubjectFormValue) => {
    setEditBusy(true);
    try {
      // Send the name only when it changed: a recolour / re-icon must not re-translate (and overwrite) the bilingual name.
      const body = v.name.trim() === initialName.trim() ? { color: v.color, icon: v.icon } : v;
      await api(`/schools/${schoolId}/subjects/${id}`, { method: 'PATCH', body });
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
      setConfirming(null);
      await q.refetch();
    } catch (e) {
      setConfirming(null);
      toast(errMsg(e), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHero mood="reading" title={t('title')} subtitle={t('subtitle')} />
      <div className="space-y-5">
        <Card data-testid="subject-add-card">
          <CardHeader>
            <CardTitle className="text-xl">{t('add')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectForm key={addKey} busy={addBusy} onSubmit={addSubject} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {subjects.length === 0 ? (
              <div data-testid="subjects-empty">
                <EmptyState mood="bored-waiting" title={t('empty')} />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {subjects.map((s) => {
                  const initialName = subjectLabel(s.name, locale);
                  const blocked = s.classCount > 0 ? t('deleteBlocked') : s.topicCount > 0 ? t('deleteBlockedTopics') : undefined;
                  return (
                  <li key={s.id} className="p-4 transition-colors hover:bg-muted/60" data-testid="subject-row">
                    {editingId === s.id ? (
                      <SubjectForm initial={{ name: initialName, color: s.color, icon: s.icon }} busy={editBusy} onSubmit={(v) => editSubject(s.id, initialName, v)} onCancel={() => setEditingId(null)} />
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <SubjectChip name={s.name} color={s.color} locale={locale} />
                        <span className="text-sm font-bold text-muted-foreground">{t('classes', { n: s.classCount })}</span>
                        <span className="text-sm font-bold text-muted-foreground">{t('teachers', { n: s.teacherCount })}</span>
                        <div className="ms-auto flex items-center gap-1">
                          <Button variant="ghost" size="icon" aria-label={t('rename')} onClick={() => setEditingId(s.id)} data-testid="subject-edit">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('delete')}
                            disabled={!!blocked || deletingId === s.id}
                            title={blocked}
                            onClick={() => setConfirming(s)}
                            data-testid="subject-delete"
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!confirming} onOpenChange={(open) => !open && !deletingId && setConfirming(null)}>
        <DialogContent data-testid="subject-delete-dialog">
          <DialogTitle>{t('deleteConfirmTitle', { name: confirming ? subjectLabel(confirming.name, locale) : '' })}</DialogTitle>
          <DialogDescription className="mt-2">{t('deleteConfirmBody')}</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={!!deletingId}>
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="button" variant="kidCoral" loading={!!deletingId} onClick={() => confirming && deleteSubject(confirming)} data-testid="subject-delete-confirm">
              {t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {node}
    </div>
  );
}
