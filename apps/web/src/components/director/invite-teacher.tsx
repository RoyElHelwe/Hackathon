'use client';

import { Link2, Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { CopyButton } from './copy-button';
import { SubjectPicker } from './subject-picker';
import type { SchoolSubject } from './types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite a teacher by email → shareable link (joins APPROVED immediately). */
export function InviteTeacher({ schoolId }: { schoolId: string }) {
  const t = useTranslations('director.members');
  const ts = useTranslations('director.subjects');
  const tc = useTranslations('common');
  const locale = useLocale();
  const {
    data: subjects,
    isLoading: subjectsLoading,
    error: subjectsError,
    refetch: refetchSubjects,
  } = useApi<SchoolSubject[]>(`/schools/${schoolId}/subjects`);
  const options = subjects ?? [];
  const [email, setEmail] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) return setErr(t('invalidEmail'));
    if (!subjectIds.length) return setErr(t('subjectsRequired'));
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string; path: string }>('/invites', { body: { email: value, role: 'TEACHER', subjectIds } });
      setLink({ email: value, url: `${window.location.origin}${r.path}` });
      setEmail('');
      setSubjectIds([]);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="invite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="flex size-9 items-center justify-center rounded-[12px] bg-med-soft text-med-d dark:text-ring">
            <Mail className="size-5" />
          </span>
          {t('invite')}
        </CardTitle>
        <CardDescription>{t('inviteBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <Label htmlFor="invite-email">{t('email')}</Label>
            <Input
              id="invite-email"
              type="email"
              dir="ltr"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              aria-invalid={!!err}
              data-testid="invite-teacher-email"
            />
          </div>
          <div>
            <Label>{t('subjectsLabel')}</Label>
            {subjectsLoading ? (
              <Skeleton className="mt-1 h-10 w-full" />
            ) : subjectsError ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-danger">
                <span>{subjectsError instanceof ApiError ? subjectsError.message : tc('error')}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => refetchSubjects()}>
                  {tc('retry')}
                </Button>
              </div>
            ) : options.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('noSubjectsYet')}{' '}
                <Link href="/director/subjects" className="font-black text-med-ink underline dark:text-ring">
                  {ts('nudgeCta')}
                </Link>
              </p>
            ) : (
              <SubjectPicker options={options} value={subjectIds} onChange={setSubjectIds} locale={locale} className="mt-1" />
            )}
          </div>
          {err && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {err}
            </p>
          )}
          <Button type="submit" variant="kid" loading={busy} disabled={subjectIds.length === 0} className="w-full" data-testid="invite-teacher">
            {!busy && <Link2 />} {t('sendInvite')}
          </Button>
        </form>
        {link && (
          <div className="space-y-2 rounded-[16px] border-2 border-cedar/30 bg-cedar-soft p-4" data-testid="invite-link">
            <p className="text-sm font-black">{t('inviteReady', { email: link.email })}</p>
            <p className="break-all rounded-[12px] border-2 border-border bg-card px-3 py-2 font-mono text-xs" dir="ltr" data-testid="invite-link-url">
              {link.url}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">{t('inviteHint')}</p>
            <CopyButton text={link.url} label={t('copyLink')} copiedLabel={t('copyLink') + ' ✓'} size="sm" data-testid="copy-invite-link" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
