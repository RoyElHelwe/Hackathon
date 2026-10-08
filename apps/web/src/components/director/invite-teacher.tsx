'use client';

import { Link2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { CopyButton } from './copy-button';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite a teacher by email → shareable link (joins APPROVED immediately). */
export function InviteTeacher() {
  const t = useTranslations('director.members');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) return setErr(t('invalidEmail'));
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string; path: string }>('/invites', { body: { email: value, role: 'TEACHER' } });
      setLink({ email: value, url: `${window.location.origin}${r.path}` });
      setEmail('');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="invite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5 text-primary" /> {t('invite')}
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
          {err && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {err}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full" data-testid="invite-teacher">
            {!busy && <Link2 />} {t('sendInvite')}
          </Button>
        </form>
        {link && (
          <div className="space-y-2 rounded-[16px] bg-mint-soft p-4" data-testid="invite-link">
            <p className="text-sm font-extrabold">{t('inviteReady', { email: link.email })}</p>
            <p className="break-all rounded-[10px] bg-card px-3 py-2 font-mono text-xs" dir="ltr" data-testid="invite-link-url">
              {link.url}
            </p>
            <p className="text-xs text-muted-foreground">{t('inviteHint')}</p>
            <CopyButton text={link.url} label={t('copyLink')} copiedLabel={t('copyLink') + ' ✓'} size="sm" data-testid="copy-invite-link" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
