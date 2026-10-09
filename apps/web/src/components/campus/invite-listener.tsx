'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bousla } from '@/components/bousla';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useSocketEvent } from '@/lib/campus/use-room';
import { useInvalidate } from '@/lib/hooks';

interface Invite {
  sessionId: string;
  fromName: string;
  topic?: string | null;
  /** "Ask a friend": they need help with a topic I mastered */
  help?: boolean;
}

/** Live "X wants to study with you" pop-up for students, anywhere in the app. */
export function InviteListener() {
  const t = useTranslations('campus');
  const router = useRouter();
  const invalidate = useInvalidate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);

  useSocketEvent<Invite>('study:invite', (d) => {
    setInvite(d);
    void invalidate('/study-sessions/mine', '/notifications');
  });
  useSocketEvent<{ sessionId: string; byName: string }>('study:accepted', () => void invalidate('/study-sessions/mine'));
  useSocketEvent('exam:scheduled', () => void invalidate('/exams/mine', '/notifications'));
  useSocketEvent('exam:open', () => void invalidate('/exams/mine', '/notifications'));
  useSocketEvent('exam:released', () => void invalidate('/exams/mine', '/notifications'));

  const join = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      await api(`/study-sessions/${invite.sessionId}/accept`, { method: 'POST' });
      router.push(`/student/study/${invite.sessionId}`);
      setInvite(null);
    } catch {
      router.push(`/student/study/${invite.sessionId}`);
      setInvite(null);
    } finally {
      setBusy(false);
    }
  };

  // "Not now" really declines, so the classmate who invited isn't left waiting for the invite to expire.
  const decline = () => {
    if (!invite) return;
    const id = invite.sessionId;
    setInvite(null);
    void api(`/study-sessions/${id}/decline`, { method: 'POST' })
      .catch(() => undefined)
      .then(() => invalidate('/study-sessions/mine'));
  };

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-3 top-20 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-[20px] border-2 border-violet bg-card p-3 shadow-2xl"
          role="alertdialog"
          aria-live="assertive"
          data-testid="study-invite-popup"
        >
          <Bousla mood="cheering" size={52} />
          <p className="min-w-0 flex-1 font-display text-base font-bold leading-tight">{invite.help && invite.topic ? t('invites.help', { name: invite.fromName.split(' ')[0], topic: invite.topic }) : t('invites.from', { name: invite.fromName.split(' ')[0] })}</p>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" variant="kid" onClick={join} loading={busy} data-testid="invite-join">
              {t('invites.accept')}
            </Button>
            <Button size="sm" variant="ghost" onClick={decline} data-testid="invite-decline">
              {t('invites.decline')}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
