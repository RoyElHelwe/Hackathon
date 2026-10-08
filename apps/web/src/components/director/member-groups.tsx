'use client';

import type { Role } from '@tajriba/shared';
import { Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { membersPath } from './pending-members';
import { SubjectChip } from './subject-chip';
import { SubjectPicker } from './subject-picker';
import type { Member, SchoolSubject } from './types';

const ORDER: Role[] = ['DIRECTOR', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT'];
const PREVIEW = 8;

/** Approved members grouped by role (tabs). */
export function MemberGroups({ schoolId }: { schoolId: string }) {
  const t = useTranslations('director.members');
  const tr = useTranslations('common.roles');
  const locale = useLocale();
  const { data, isLoading, error, refetch } = useApi<Member[]>(membersPath(schoolId, 'APPROVED'));
  const {
    data: subjectData,
    isLoading: subjectsLoading,
    error: subjectsError,
    refetch: refetchSubjects,
  } = useApi<SchoolSubject[]>(`/schools/${schoolId}/subjects`);
  const subjectOptions = subjectData ?? [];
  const groups = ORDER.map((role) => ({ role, items: (data ?? []).filter((m) => m.role === role).sort((a, b) => a.user.name.localeCompare(b.user.name)) })).filter(
    (g) => g.items.length || g.role === 'TEACHER',
  );

  return (
    <Card data-testid="approved-members">
      <CardHeader>
        <CardTitle>{t('approvedTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => refetch()} className="py-4" />
        ) : (
          <Tabs defaultValue="TEACHER">
            <TabsList className="mb-4 flex w-full flex-wrap justify-start">
              {groups.map((g) => (
                <TabsTrigger key={g.role} value={g.role} className="flex items-center gap-1.5" data-testid={`members-tab-${g.role}`}>
                  {tr(g.role)} <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{g.items.length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {groups.map((g) => (
              <TabsContent key={g.role} value={g.role}>
                <RoleList
                  items={g.items}
                  role={g.role}
                  locale={locale}
                  subjectOptions={subjectOptions}
                  subjectsLoading={subjectsLoading}
                  subjectsError={subjectsError}
                  onRetrySubjects={refetchSubjects}
                  onSubjectsSaved={refetch}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function RoleList({
  items,
  role,
  locale,
  subjectOptions,
  subjectsLoading,
  subjectsError,
  onRetrySubjects,
  onSubjectsSaved,
}: {
  items: Member[];
  role: Role;
  locale: string;
  subjectOptions: SchoolSubject[];
  subjectsLoading: boolean;
  subjectsError: unknown;
  onRetrySubjects: () => void;
  onSubjectsSaved: () => void;
}) {
  const t = useTranslations('director.members');
  const tr = useTranslations('common.roles');
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="py-4 text-center text-sm text-muted-foreground">{t('emptyRole')}</p>;
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((m) => (
          <li key={m.id} className="flex items-start gap-3 rounded-[14px] p-2 hover:bg-muted/60" data-testid="member-row">
            <Avatar name={m.user.name} src={m.user.avatarUrl} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{m.user.name}</p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {m.user.email}
              </p>
              {role === 'TEACHER' && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {m.subjects.map((s) => (
                    <SubjectChip key={s.id} name={s.name} color={subjectOptions.find((o) => o.id === s.id)?.color ?? 'violet'} locale={locale} />
                  ))}
                  <TeacherSubjectsEditor
                    member={m}
                    options={subjectOptions}
                    optionsLoading={subjectsLoading}
                    optionsError={subjectsError}
                    onRetryOptions={onRetrySubjects}
                    locale={locale}
                    onSaved={onSubjectsSaved}
                  />
                </div>
              )}
            </div>
            <Badge variant="muted" className="hidden sm:inline-flex">
              {tr(m.role)}
            </Badge>
          </li>
        ))}
      </ul>
      {items.length > PREVIEW && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll((a) => !a)}>
          {all ? t('showLess') : t('showAll', { n: items.length })}
        </Button>
      )}
    </>
  );
}

/** Ghost button + dialog to edit which subjects a teacher is assigned. */
function TeacherSubjectsEditor({
  member,
  options,
  optionsLoading,
  optionsError,
  onRetryOptions,
  locale,
  onSaved,
}: {
  member: Member;
  options: SchoolSubject[];
  optionsLoading: boolean;
  optionsError: unknown;
  onRetryOptions: () => void;
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations('director.members');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>(member.subjects.map((s) => s.id));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setIds(member.subjects.map((s) => s.id));
      setErr(null);
    }
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/memberships/${member.id}/subjects`, { method: 'PUT', body: { subjectIds: ids } });
      onSaved();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" data-testid="edit-subjects">
          <Pencil className="size-3" /> {t('editSubjects')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t('editSubjects')}</DialogTitle>
        <DialogDescription>{member.user.name}</DialogDescription>
        <div className="mt-4 space-y-3">
          {optionsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : optionsError ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-danger">
              <span>{optionsError instanceof ApiError ? optionsError.message : tc('error')}</span>
              <Button type="button" variant="ghost" size="sm" onClick={onRetryOptions}>
                {tc('retry')}
              </Button>
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSubjectsYet')}</p>
          ) : (
            <SubjectPicker options={options} value={ids} onChange={setIds} locale={locale} />
          )}
          {err && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {err}
            </p>
          )}
          <Button onClick={save} loading={busy} disabled={ids.length === 0} className="w-full" data-testid="save-subjects">
            {t('saveSubjects')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
