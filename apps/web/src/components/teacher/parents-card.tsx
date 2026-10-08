'use client';

import { Mail, MessageCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { CopyButton } from './copy-button';
import { errMessage } from './helpers';
import type { ClassStudent } from './types';

/** Linked parents + "Invite parent by email". */
export function ParentsCard({ student }: { student: ClassStudent }) {
  const t = useTranslations('teacher.student');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const first = student.name.split(' ')[0];

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; path: string }>('/invites', { body: { email: email.trim(), role: 'PARENT', studentId: student.id } });
      setLink({ email: email.trim(), url: `${window.location.origin}${res.path}` });
      setEmail('');
    } catch (err) {
      setError(errMessage(err, t('inviteError')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {student.parents.length ? (
        <ul className="space-y-2" data-testid="parent-links">
          {student.parents.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-[16px] border border-border p-3">
              <Avatar name={p.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/teacher/messages?with=${p.id}`} data-testid="message-parent">
                  <MessageCircle /> {t('message')}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[14px] bg-muted px-4 py-3 text-sm text-muted-foreground">{t('noParents', { name: first })}</p>
      )}

      <form onSubmit={invite} className="space-y-2">
        <Label htmlFor="parent-email">{t('inviteLabel')}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="parent-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('invitePlaceholder')}
              className="ps-10"
              data-testid="invite-parent-email"
            />
          </div>
          <Button type="submit" loading={busy} disabled={!email.trim()} data-testid="invite-parent-submit">
            <UserPlus /> {t('invite')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('inviteHint', { name: first })}</p>
        {error && (
          <p className="rounded-[12px] bg-coral-soft px-3 py-2 text-sm font-bold text-danger" role="alert">
            {error}
          </p>
        )}
      </form>

      {link && (
        <div className="rounded-[16px] border border-mint/50 bg-mint-soft p-4" data-testid="invite-link">
          <p className="text-sm font-bold">{t('inviteReady', { email: link.email })}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[10px] bg-card px-3 py-2 text-xs" data-testid="invite-link-url">
              {link.url}
            </code>
            <CopyButton value={link.url} testId="copy-invite-link" />
          </div>
        </div>
      )}
    </div>
  );
}
