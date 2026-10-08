'use client';

import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/hooks';
import { errMessage } from './helpers';
import { toast } from './toast';
import type { SyncResult } from './types';

/** "Sync now" — pulls the latest roster from Google Classroom. */
export function SyncButton({ classId }: { classId: string }) {
  const t = useTranslations('teacher.sync');
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const sync = async () => {
    setBusy(true);
    try {
      const r = await api<SyncResult>(`/classes/${classId}/sync`, { method: 'POST' });
      if (r.reconnect) toast(t('reconnect'), 'error');
      else {
        const parts = [t('students', { n: r.total }), t('added', { n: r.added })];
        if (r.archived) parts.push(t('archived', { n: r.archived }));
        toast(parts.join(' · '));
      }
    } catch (e) {
      toast(errMessage(e, t('error')), 'error');
    } finally {
      setBusy(false);
      await invalidate(`/dashboards/teacher/${classId}`, `/classes/${classId}/students`, '/classes');
    }
  };
  return (
    <Button variant="outline" onClick={sync} disabled={busy} data-testid="sync-now">
      <RefreshCw className={busy ? 'animate-spin' : undefined} /> {busy ? t('syncing') : t('cta')}
    </Button>
  );
}
