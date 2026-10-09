'use client';

import { Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, Switch } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useApi, useInvalidate } from '@/lib/hooks';
import { errMessage } from './helpers';
import { toast } from './toast';
import type { Leaderboard } from './types';

/** Leaderboard toggle (OFF by default) with a preview of what students see. */
export function LeaderboardCard({ classId, enabled }: { classId: string; enabled: boolean }) {
  const t = useTranslations('teacher.leaderboard');
  const invalidate = useInvalidate();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const { data: board } = useApi<Leaderboard>(on ? `/classes/${classId}/leaderboard` : null, { retry: false });

  const toggle = async (v: boolean) => {
    setOn(v);
    setBusy(true);
    try {
      await api(`/classes/${classId}/settings`, { method: 'PATCH', body: { leaderboardEnabled: v } });
      toast(v ? t('turnedOn') : t('turnedOff'));
      await invalidate(`/dashboards/teacher/${classId}`, '/classes', `/classes/${classId}/leaderboard`);
    } catch (e) {
      setOn(!v);
      toast(errMessage(e, t('error')), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trophy className="size-5 text-flame" /> {t('title')}
          </CardTitle>
          <CardDescription className="mt-1">{t('explain')}</CardDescription>
        </div>
        <Switch checked={on} onCheckedChange={toggle} disabled={busy} aria-label={t('title')} data-testid="leaderboard-toggle" />
      </CardHeader>
      <CardContent>
        {on && board?.top.length ? (
          <ol className="space-y-1.5">
            {board.top.map((r) => (
              <li key={r.studentId} className="flex items-center gap-2 rounded-[12px] border-2 border-border px-3 py-1.5 text-sm first:border-flame/50 first:bg-flame-soft">
                <span className="w-5 text-center font-black tabular-nums text-muted-foreground">{r.rank}</span>
                <Avatar name={r.name} src={r.avatarUrl} className="size-6 text-[10px]" />
                <span className="flex-1 truncate font-extrabold">{r.name}</span>
                <span className="font-black tabular-nums text-med-d dark:text-med">{r.xp} XP</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-[14px] bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground">{on ? t('previewEmpty') : t('offNote')}</p>
        )}
      </CardContent>
    </Card>
  );
}
